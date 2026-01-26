import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { Pool } from "pg";
import { randomUUID } from "crypto";
import { JobQueue } from "@croco/queue";
import { JobType, IdempotencyStep, buildIdempotencyKey } from "@croco/core";
import { verifyWebhook } from "@croco/ghl";
import { resolveTenantFromRequest } from "@croco/config";
import { insertIdempotencyKey } from "@croco/db";
import { recordAuditEvent } from "@croco/audit";
import { Logger } from "@croco/observability";

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

export function buildServer(deps: BuildServerDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger });

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

  app.post(
    "/webhooks/ghl",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const tenant = await resolveTenantFromRequest(request.headers, deps.pool);
      if (!tenant) {
        return reply.code(401).send({ ok: false, error: "tenant_not_found" });
      }

      const body = request.body as WebhookBody;
      const rawBody = (request as FastifyRequest & { rawBody?: string }).rawBody ?? "";
      const signature = request.headers["x-ghl-signature"] as string | undefined;
      const webhookSecret = (tenant.config?.webhook_secret as string | undefined) ?? process.env.GHL_WEBHOOK_SECRET;

      if (!verifyWebhook(signature, rawBody, webhookSecret)) {
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
