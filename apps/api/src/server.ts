import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import { JobQueue } from "@croco/queue";
import { JobType, IdempotencyStep, buildIdempotencyKey } from "@croco/core";
import { verifyWebhook } from "@croco/ghl";
import { resolveTenantFromRequest } from "@croco/config";
import { insertIdempotencyKey } from "@croco/db";
import { recordAuditEvent } from "@croco/audit";
import { Logger, incCounter, registerCounter, renderMetrics } from "@croco/observability";

interface BuildServerDeps {
  logger: Logger;
  pool: Pool;
  queue: JobQueue;
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

export function buildServer(deps: BuildServerDeps): FastifyInstance {
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
