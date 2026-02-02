import Fastify, { FastifyReply, FastifyRequest } from "fastify";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import { JobQueue } from "@croco/queue";
import { JobType, IdempotencyStep, buildIdempotencyKey } from "@croco/core";
import { verifyWebhook } from "@croco/ghl";
import { encryptSecret, resolveTenantFromRequest } from "@croco/config";
import { getInvoiceDetails, insertIdempotencyKey, listAuditEventsForInvoice, listInvoices } from "@croco/db";
import { recordAuditEvent } from "@croco/audit";
import { Logger, incCounter, registerCounter, renderMetrics } from "@croco/observability";
import { StorageClient } from "@croco/storage";

interface BuildServerDeps {
  logger: Logger;
  pool: Pool;
  queue: JobQueue;
  storageClient: StorageClient;
}

interface WebhookBody {
  eventId?: string;
  invoiceId?: string;
  updatedAt?: string;
  id?: string | number;
  [key: string]: unknown;
}

interface RateLimiterState {
  _rate?: Map<string, number>;
}

const REQUEST_LIMIT_WINDOW_MS = 1000;

function parseCursor(cursor?: string): { createdAt?: string; id?: string } {
  if (!cursor) {
    return {};
  }
  const idx = cursor.indexOf("|");
  if (idx <= 0) {
    return {};
  }
  const createdAt = cursor.slice(0, idx);
  const id = cursor.slice(idx + 1);
  if (!createdAt || !id) {
    return {};
  }
  return { createdAt, id };
}

async function requireTenant(
  request: FastifyRequest,
  deps: BuildServerDeps
): Promise<import("@croco/core").Tenant> {
  const tenant = await resolveTenantFromRequest(request.headers, deps.pool);
  if (!tenant) {
    throw Object.assign(new Error("tenant_not_found"), { statusCode: 401 });
  }

  const configuredToken =
    (tenant.config?.api_token as string | undefined) ?? process.env.TENANT_API_TOKEN;
  if (configuredToken) {
    const auth = request.headers.authorization;
    if (!auth || auth !== `Bearer ${configuredToken}`) {
      throw Object.assign(new Error("unauthorized"), { statusCode: 401 });
    }
  }

  return tenant;
}

export function buildServer(deps: BuildServerDeps) {
  const app = Fastify({ logger: deps.logger });
  registerCounter("webhook_received_total", "Total webhook requests received");
  registerCounter("webhook_invalid_signature_total", "Total webhook signature failures");
  registerCounter("webhook_duplicate_total", "Total duplicate webhook events");

  app.addContentTypeParser(
    "application/json",
    { parseAs: "string" },
    (request: FastifyRequest, body: string, done) => {
      (request as FastifyRequest & { rawBody?: string }).rawBody = body;
      try {
        const json = body ? JSON.parse(body) : {};
        done(null, json);
      } catch (error) {
        done(error as Error, undefined);
      }
    }
  );

  app.get("/health", async () => ({ ok: true }));
  app.get("/metrics", async (request, reply) => {
    const metricsToken = process.env.METRICS_TOKEN;
    if (metricsToken) {
      const auth = request.headers.authorization;
      if (!auth || auth !== `Bearer ${metricsToken}`) {
        return reply.code(401).send({ ok: false, error: "unauthorized" });
      }
    }
    reply.header("Content-Type", "text/plain; version=0.0.4");
    return renderMetrics();
  });

  app.get("/api/v1/settings", async (request, reply) => {
    try {
      const tenant = await requireTenant(request, deps);
      const result = await deps.pool.query(
        "SELECT ghl_api_key_enc, pdp_api_key_enc FROM tenant_secrets WHERE tenant_id = $1",
        [tenant.id]
      );
      const row = (result.rows[0] ?? {}) as {
        ghl_api_key_enc?: string | null;
        pdp_api_key_enc?: string | null;
      };

      return reply.code(200).send({
        ok: true,
        tenant: { id: tenant.id, name: tenant.name },
        integrations: {
          ghl: { configured: Boolean(row.ghl_api_key_enc) },
          pdp: {
            provider: process.env.PDP_PROVIDER ?? "mock",
            configured: Boolean(row.pdp_api_key_enc)
          }
        }
      });
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
      return reply.code(statusCode).send({ ok: false, error: (error as Error).message });
    }
  });

  app.post("/api/v1/settings/pdp", async (request, reply) => {
    try {
      const tenant = await requireTenant(request, deps);
      const body = request.body as Record<string, unknown>;
      const token =
        (typeof body.token === "string" && body.token.trim()) ||
        (typeof body.apiKey === "string" && body.apiKey.trim()) ||
        null;
      if (!token) {
        return reply.code(400).send({ ok: false, error: "pdp_token_required" });
      }

      const secret = encryptSecret(token);
      await deps.pool.query(
        "INSERT INTO tenant_secrets (tenant_id, pdp_api_key_enc, enc_version, enc_nonce) VALUES ($1, $2, $3, $4) ON CONFLICT (tenant_id) DO UPDATE SET pdp_api_key_enc = EXCLUDED.pdp_api_key_enc, enc_version = EXCLUDED.enc_version, enc_nonce = EXCLUDED.enc_nonce, updated_at = now()",
        [tenant.id, secret.ciphertext, secret.version, secret.nonce]
      );

      const correlationId =
        (request.headers["x-correlation-id"] as string | undefined) ?? randomUUID();
      await recordAuditEvent(deps.pool, {
        tenantId: tenant.id,
        correlationId,
        actor: "api",
        eventType: "settings.pdp.updated",
        payload: { provider: process.env.PDP_PROVIDER ?? "mock" }
      });

      return reply.code(200).send({ ok: true });
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
      return reply.code(statusCode).send({ ok: false, error: (error as Error).message });
    }
  });

  app.post("/api/v1/actions/send-invoice", async (request, reply) => {
    try {
      const tenant = await requireTenant(request, deps);
      const body = request.body as Record<string, unknown>;
      const ghlInvoiceId =
        (typeof body.ghlInvoiceId === "string" && body.ghlInvoiceId) ||
        (typeof body.invoiceId === "string" && body.invoiceId) ||
        (typeof body.invoice_id === "string" && body.invoice_id) ||
        (typeof body.invoiceId === "number" && body.invoiceId.toString()) ||
        (typeof body.invoice_id === "number" && body.invoice_id.toString()) ||
        "";
      if (!ghlInvoiceId) {
        return reply.code(400).send({ ok: false, error: "invoice_id_required" });
      }

      const correlationId =
        (request.headers["x-correlation-id"] as string | undefined) ?? randomUUID();

      const invoiceResult = await deps.pool.query(
        "INSERT INTO invoices (tenant_id, ghl_invoice_id, raw_payload, status) VALUES ($1, $2, $3, 'NEW') ON CONFLICT (tenant_id, ghl_invoice_id) DO UPDATE SET raw_payload = EXCLUDED.raw_payload, updated_at = now() RETURNING id",
        [tenant.id, ghlInvoiceId, { source: "action.send-invoice", ...body }]
      );
      const invoiceId = invoiceResult.rows[0].id as string;

      const enqueueResult = await deps.queue.enqueue(
        JobType.FETCH_INVOICE,
        {
          tenantId: tenant.id,
          invoiceId,
          ghlInvoiceId,
          correlationId
        },
        {
          tenantId: tenant.id,
          correlationId,
          idempotencyKey: buildIdempotencyKey(IdempotencyStep.FETCH, tenant.id, ghlInvoiceId)
        }
      );

      await recordAuditEvent(deps.pool, {
        tenantId: tenant.id,
        correlationId,
        actor: "action",
        eventType: "action.send_invoice.received",
        payload: { ghlInvoiceId, enqueued: enqueueResult.enqueued },
        invoiceId
      });

      return reply.code(200).send({ ok: true, invoiceId, enqueued: enqueueResult.enqueued });
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
      return reply.code(statusCode).send({ ok: false, error: (error as Error).message });
    }
  });

  app.get("/api/v1/invoices", async (request, reply) => {
    try {
      const tenant = await requireTenant(request, deps);
      const query = request.query as Record<string, unknown>;
      const limit = Number(query.limit ?? 50);
      const cursor = typeof query.cursor === "string" ? query.cursor : undefined;
      const status = typeof query.status === "string" ? query.status : undefined;
      const ghlInvoiceId =
        typeof query.ghlInvoiceId === "string" ? query.ghlInvoiceId : undefined;
      const { createdAt, id } = parseCursor(cursor);

      const rows = await listInvoices(deps.pool, {
        tenantId: tenant.id,
        limit: Number.isFinite(limit) ? limit : 50,
        cursorCreatedAt: createdAt,
        cursorId: id,
        status,
        ghlInvoiceId
      });
      const nextCursor =
        rows.length > 0 ? `${rows[rows.length - 1].created_at}|${rows[rows.length - 1].id}` : null;

      return reply.code(200).send({ ok: true, invoices: rows, nextCursor });
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
      return reply.code(statusCode).send({ ok: false, error: (error as Error).message });
    }
  });

  app.get("/api/v1/invoices/:invoiceId", async (request, reply) => {
    try {
      const tenant = await requireTenant(request, deps);
      const invoiceId = (request.params as { invoiceId: string }).invoiceId;
      const row = await getInvoiceDetails(deps.pool, { tenantId: tenant.id, invoiceId });
      if (!row) {
        return reply.code(404).send({ ok: false, error: "not_found" });
      }
      return reply.code(200).send({ ok: true, invoice: row });
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
      return reply.code(statusCode).send({ ok: false, error: (error as Error).message });
    }
  });

  app.get("/api/v1/invoices/:invoiceId/artifacts/pdf", async (request, reply) => {
    try {
      const tenant = await requireTenant(request, deps);
      const invoiceId = (request.params as { invoiceId: string }).invoiceId;
      const row = await getInvoiceDetails(deps.pool, { tenantId: tenant.id, invoiceId });
      if (!row || !row.latest_pdf_key) {
        return reply.code(404).send({ ok: false, error: "not_found" });
      }
      const pdf = await deps.storageClient.getObject(row.latest_pdf_key);
      reply.header("Content-Type", "application/pdf");
      reply.header(
        "Content-Disposition",
        `attachment; filename="${row.ghl_invoice_id || row.id}.pdf"`
      );
      return reply.code(200).send(pdf);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
      return reply.code(statusCode).send({ ok: false, error: (error as Error).message });
    }
  });

  app.get("/api/v1/invoices/:invoiceId/artifacts/xml", async (request, reply) => {
    try {
      const tenant = await requireTenant(request, deps);
      const invoiceId = (request.params as { invoiceId: string }).invoiceId;
      const row = await getInvoiceDetails(deps.pool, { tenantId: tenant.id, invoiceId });
      if (!row || !row.latest_xml_key) {
        return reply.code(404).send({ ok: false, error: "not_found" });
      }
      const xml = await deps.storageClient.getObject(row.latest_xml_key);
      reply.header("Content-Type", "application/xml");
      reply.header(
        "Content-Disposition",
        `attachment; filename="${row.ghl_invoice_id || row.id}.xml"`
      );
      return reply.code(200).send(xml);
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
      return reply.code(statusCode).send({ ok: false, error: (error as Error).message });
    }
  });

  app.get("/api/v1/invoices/:invoiceId/audit", async (request, reply) => {
    try {
      const tenant = await requireTenant(request, deps);
      const invoiceId = (request.params as { invoiceId: string }).invoiceId;
      const query = request.query as Record<string, unknown>;
      const limit = Number(query.limit ?? 50);
      const events = await listAuditEventsForInvoice(deps.pool, {
        tenantId: tenant.id,
        invoiceId,
        limit: Number.isFinite(limit) ? limit : 50
      });
      return reply.code(200).send({ ok: true, events });
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
      return reply.code(statusCode).send({ ok: false, error: (error as Error).message });
    }
  });

  app.post(
    "/webhooks/ghl",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const maxRequests = Number(process.env.WEBHOOK_RATE_LIMIT ?? 0);
      if (maxRequests > 0) {
        const now = Date.now();
        const bucket = Math.floor(now / REQUEST_LIMIT_WINDOW_MS);
        const key = `webhook:${bucket}`;
        const requestCount = ((app as unknown as RateLimiterState)._rate ?? new Map<string, number>());
        (app as unknown as RateLimiterState)._rate = requestCount;
        const current = requestCount.get(key) ?? 0;
        if (current >= maxRequests) {
          return reply.code(429).send({ ok: false, error: "rate_limited" });
        }
        requestCount.set(key, current + 1);
        if (requestCount.size > 1000) {
          requestCount.clear();
        }
      }
      const tenant = await resolveTenantFromRequest(request.headers, deps.pool);
      if (!tenant) {
        return reply.code(401).send({ ok: false, error: "tenant_not_found" });
      }

      incCounter("webhook_received_total", { tenantId: tenant.id });
      const body = request.body as WebhookBody;
      const rawBody = (request as FastifyRequest & { rawBody?: string }).rawBody ?? "";
      const signature = request.headers["x-ghl-signature"] as string | undefined;
      const webhookSecret = (tenant.config?.webhook_secret as string | undefined) ?? process.env.GHL_WEBHOOK_SECRET;

      if (!verifyWebhook(signature, rawBody, webhookSecret)) {
        incCounter("webhook_invalid_signature_total", { tenantId: tenant.id });
        return reply.code(401).send({ ok: false, error: "invalid_signature" });
      }

      const correlationId =
        (request.headers["x-correlation-id"] as string | undefined) ?? randomUUID();

      const eventId =
        body.eventId ?? body.id?.toString() ?? `${body.invoiceId ?? "unknown"}:${body.updatedAt ?? ""}`;

      const webhookKey = buildIdempotencyKey(IdempotencyStep.WEBHOOK, tenant.id, eventId);
      const firstSeen = await insertIdempotencyKey(deps.pool, {
        tenantId: tenant.id,
        step: IdempotencyStep.WEBHOOK,
        key: webhookKey,
        correlationId
      });
      if (!firstSeen) {
        incCounter("webhook_duplicate_total", { tenantId: tenant.id });
        return reply.code(200).send({ ok: true, duplicate: true });
      }

      const ghlInvoiceId = body.invoiceId?.toString() ?? "";
      const invoiceResult = await deps.pool.query(
        "INSERT INTO invoices (tenant_id, ghl_invoice_id, raw_payload, status) VALUES ($1, $2, $3, 'NEW') ON CONFLICT (tenant_id, ghl_invoice_id) DO UPDATE SET raw_payload = EXCLUDED.raw_payload, updated_at = now() RETURNING id",
        [tenant.id, ghlInvoiceId, body]
      );
      const invoiceId = invoiceResult.rows[0].id as string;

      await deps.queue.enqueue(
        JobType.FETCH_INVOICE,
        {
          tenantId: tenant.id,
          invoiceId,
          ghlInvoiceId,
          correlationId
        },
        {
          tenantId: tenant.id,
          correlationId,
          idempotencyKey: buildIdempotencyKey(IdempotencyStep.FETCH, tenant.id, ghlInvoiceId)
        }
      );

      await recordAuditEvent(deps.pool, {
        tenantId: tenant.id,
        correlationId,
        actor: "webhook",
        eventType: "webhook.received",
        payload: {
          eventId,
          ghlInvoiceId
        },
        invoiceId
      });

      return reply.code(200).send({ ok: true });
    }
  );

  return app;
}
