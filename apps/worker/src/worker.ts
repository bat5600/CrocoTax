import { Pool } from "pg";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { JobQueue, QueueJob } from "@croco/queue";
import { JobPayloads, JobType, IdempotencyStep, buildIdempotencyKey, CanonicalInvoice } from "@croco/core";
import { recordAuditEvent } from "@croco/audit";
import { Logger, incCounter, registerCounter } from "@croco/observability";
import { createGhlClient, mapGhlToCanonical } from "@croco/ghl";
import { createFacturxGenerator } from "@croco/facturx";
import { createStorageClient } from "@croco/storage";
import { createPdpClient } from "@croco/pdp";
import {
  getInvoice,
  updateInvoiceRawPayload,
  updateInvoiceCanonicalPayload,
  updateInvoiceStatus,
  insertInvoiceArtifacts,
  getLatestArtifacts,
  upsertPdpSubmission,
  getLatestSubmission,
  updatePdpSubmissionStatus,
  listPendingSubmissions
} from "@croco/db";
import { getTenantSecrets } from "@croco/config";

export interface WorkerContext {
  pool: Pool;
  queue: JobQueue;
  logger: Logger;
  ghlClient: ReturnType<typeof createGhlClient>;
  facturxGenerator: ReturnType<typeof createFacturxGenerator>;
  storageClient: ReturnType<typeof createStorageClient>;
  pdpClient: ReturnType<typeof createPdpClient>;
}

type JobHandler<K extends JobType> = (
  job: QueueJob<JobPayloads[K]>,
  ctx: WorkerContext
) => Promise<void>;

type Handlers = {
  [K in JobType]: JobHandler<K>;
};

function correlationIdFrom(job: QueueJob): string {
  return job.correlationId ?? randomUUID();
}

async function storeArtifacts(
  ctx: WorkerContext,
  invoiceId: string,
  tenantId: string,
  artifacts: { pdfPath: string; xmlPath: string; pdfSha256?: string; xmlSha256?: string }
): Promise<{ pdfKey: string; xmlKey: string }> {
  const pdfBuffer = readFileSync(artifacts.pdfPath);
  const xmlBuffer = readFileSync(artifacts.xmlPath);

  const pdfKey = `tenants/${tenantId}/invoices/${invoiceId}/facturx.pdf`;
  const xmlKey = `tenants/${tenantId}/invoices/${invoiceId}/facturx.xml`;

  await ctx.storageClient.putObject(pdfKey, pdfBuffer, "application/pdf");
  await ctx.storageClient.putObject(xmlKey, xmlBuffer, "application/xml");

  await insertInvoiceArtifacts(ctx.pool, {
    invoiceId,
    pdfKey,
    xmlKey,
    pdfSha256: artifacts.pdfSha256,
    xmlSha256: artifacts.xmlSha256
  });

  return { pdfKey, xmlKey };
}

function mapPdpStatusToInvoice(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === "ACCEPTED") return "ACCEPTED";
  if (normalized === "REJECTED") return "REJECTED";
  if (normalized === "PAID") return "PAID";
  if (normalized === "SUBMITTED" || normalized === "PROCESSING" || normalized === "PENDING") {
    return "SYNCED";
  }
  return "SYNCED";
}

function isPendingStatus(status: string): boolean {
  const normalized = status.toUpperCase();
  return ["SUBMITTED", "PROCESSING", "PENDING", "SYNCED"].includes(normalized);
}

function computeNextRun(attempts: number, maxMs = 10 * 60 * 1000): Date {
  const delay = Math.min(Math.pow(2, Math.max(attempts, 1)) * 1000, maxMs);
  return new Date(Date.now() + delay);
}

export function createHandlers(ctx: WorkerContext): Handlers {
  registerCounter("worker_job_completed_total", "Total jobs completed");
  registerCounter("worker_job_failed_total", "Total jobs failed");
  return {
    [JobType.FETCH_INVOICE]: async (job) => {
      const correlationId = correlationIdFrom(job);
      const invoice = await getInvoice(ctx.pool, job.payload.tenantId, job.payload.invoiceId);
      if (!invoice) {
        throw new Error("Invoice not found");
      }

      const secrets = await getTenantSecrets(ctx.pool, job.payload.tenantId);
      let fetchedPayload: Record<string, unknown> | null = null;
      try {
        const fetched = await ctx.ghlClient.fetchInvoice(
          job.payload.tenantId,
          job.payload.ghlInvoiceId,
          { apiKey: secrets.ghlApiKey, correlationId }
        );
        if (Object.keys(fetched).length > 0) {
          fetchedPayload = fetched as Record<string, unknown>;
          await updateInvoiceRawPayload(
            ctx.pool,
            job.payload.tenantId,
            job.payload.invoiceId,
            fetchedPayload
          );
        }
      } catch (error) {
        ctx.logger.warn({ error }, "ghl.fetch_failed");
      }

      await updateInvoiceStatus(ctx.pool, job.payload.tenantId, job.payload.invoiceId, "FETCHED");
      await recordAuditEvent(ctx.pool, {
        tenantId: job.payload.tenantId,
        correlationId,
        actor: "worker",
        eventType: "fetch_invoice.completed",
        payload: { ghlInvoiceId: job.payload.ghlInvoiceId, fetched: Boolean(fetchedPayload) },
        invoiceId: job.payload.invoiceId,
        jobId: job.id
      });
      await ctx.queue.enqueue(
        JobType.MAP_CANONICAL,
        {
          tenantId: job.payload.tenantId,
          invoiceId: job.payload.invoiceId,
          correlationId
        },
        {
          tenantId: job.payload.tenantId,
          correlationId,
          idempotencyKey: buildIdempotencyKey(
            IdempotencyStep.MAP,
            job.payload.tenantId,
            job.payload.invoiceId
          )
        }
      );
    },
    [JobType.MAP_CANONICAL]: async (job) => {
      const correlationId = correlationIdFrom(job);
      const invoice = await getInvoice(ctx.pool, job.payload.tenantId, job.payload.invoiceId);
      if (!invoice?.raw_payload) {
        throw new Error("Invoice raw payload missing");
      }

      const canonical = mapGhlToCanonical(job.payload.tenantId, invoice.raw_payload);
      await updateInvoiceCanonicalPayload(
        ctx.pool,
        job.payload.tenantId,
        job.payload.invoiceId,
        canonical as unknown as Record<string, unknown>
      );
      await updateInvoiceStatus(ctx.pool, job.payload.tenantId, job.payload.invoiceId, "MAPPED");
      await recordAuditEvent(ctx.pool, {
        tenantId: job.payload.tenantId,
        correlationId,
        actor: "worker",
        eventType: "map_canonical.completed",
        payload: { invoiceNumber: canonical.invoiceNumber },
        invoiceId: job.payload.invoiceId,
        jobId: job.id
      });
      await ctx.queue.enqueue(
        JobType.GENERATE_FACTURX,
        {
          tenantId: job.payload.tenantId,
          invoiceId: job.payload.invoiceId,
          correlationId
        },
        {
          tenantId: job.payload.tenantId,
          correlationId,
          idempotencyKey: buildIdempotencyKey(
            IdempotencyStep.GENERATE,
            job.payload.tenantId,
            job.payload.invoiceId
          )
        }
      );
    },
    [JobType.GENERATE_FACTURX]: async (job) => {
      const correlationId = correlationIdFrom(job);
      const invoice = await getInvoice(ctx.pool, job.payload.tenantId, job.payload.invoiceId);
      if (!invoice?.canonical_payload) {
        throw new Error("Canonical invoice missing");
      }

      const canonical = invoice.canonical_payload as CanonicalInvoice;
      const artifacts = await ctx.facturxGenerator.generate(canonical);
      await storeArtifacts(ctx, job.payload.invoiceId, job.payload.tenantId, artifacts);
      await updateInvoiceStatus(ctx.pool, job.payload.tenantId, job.payload.invoiceId, "GENERATED");
      await recordAuditEvent(ctx.pool, {
        tenantId: job.payload.tenantId,
        correlationId,
        actor: "worker",
        eventType: "generate_facturx.completed",
        payload: { pdfKey: `tenants/${job.payload.tenantId}/invoices/${job.payload.invoiceId}/facturx.pdf` },
        invoiceId: job.payload.invoiceId,
        jobId: job.id
      });
      await ctx.queue.enqueue(
        JobType.SUBMIT_PDP,
        {
          tenantId: job.payload.tenantId,
          invoiceId: job.payload.invoiceId,
          correlationId
        },
        {
          tenantId: job.payload.tenantId,
          correlationId,
          idempotencyKey: buildIdempotencyKey(
            IdempotencyStep.SUBMIT,
            job.payload.tenantId,
            job.payload.invoiceId
          )
        }
      );
    },
    [JobType.SUBMIT_PDP]: async (job) => {
      const correlationId = correlationIdFrom(job);
      const invoice = await getInvoice(ctx.pool, job.payload.tenantId, job.payload.invoiceId);
      if (!invoice?.canonical_payload) {
        throw new Error("Canonical invoice missing");
      }

      const artifacts = await getLatestArtifacts(
        ctx.pool,
        job.payload.tenantId,
        job.payload.invoiceId
      );
      if (!artifacts?.pdf_key || !artifacts?.xml_key) {
        throw new Error("Invoice artifacts missing");
      }

      const artifactMode = process.env.PDP_ARTIFACT_MODE ?? "base64";
      const pdfBuffer =
        artifactMode === "base64" ? await ctx.storageClient.getObject(artifacts.pdf_key) : null;
      const xmlBuffer =
        artifactMode === "base64" ? await ctx.storageClient.getObject(artifacts.xml_key) : null;
      const canonical = invoice.canonical_payload as CanonicalInvoice;
      const secrets = await getTenantSecrets(ctx.pool, job.payload.tenantId);
      let pdpSubmission;
      try {
        pdpSubmission = await ctx.pdpClient.submit(
          job.payload.tenantId,
          canonical,
          {
            pdf: {
              key: artifacts.pdf_key,
              sha256: artifacts.pdf_sha256 ?? undefined,
              base64: pdfBuffer ? pdfBuffer.toString("base64") : undefined
            },
            xml: {
              key: artifacts.xml_key,
              sha256: artifacts.xml_sha256 ?? undefined,
              base64: xmlBuffer ? xmlBuffer.toString("base64") : undefined
            }
          },
          {
            apiKey: secrets.pdpApiKey,
            correlationId,
            idempotencyKey: buildIdempotencyKey(
              IdempotencyStep.SUBMIT,
              job.payload.tenantId,
              job.payload.invoiceId
            )
          }
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : "pdp_submit_failed";
        await recordAuditEvent(ctx.pool, {
          tenantId: job.payload.tenantId,
          correlationId,
          actor: "worker",
          eventType: "submit_pdp.failed",
          payload: { error: message },
          invoiceId: job.payload.invoiceId,
          jobId: job.id
        });
        throw error;
      }

      await upsertPdpSubmission(ctx.pool, {
        tenantId: job.payload.tenantId,
        invoiceId: job.payload.invoiceId,
        provider: pdpSubmission.provider,
        submissionId: pdpSubmission.submissionId,
        status: pdpSubmission.status
      });

      await updateInvoiceStatus(ctx.pool, job.payload.tenantId, job.payload.invoiceId, "SUBMITTED");
      await recordAuditEvent(ctx.pool, {
        tenantId: job.payload.tenantId,
        correlationId,
        actor: "worker",
        eventType: "submit_pdp.completed",
        payload: { submissionId: pdpSubmission.submissionId, provider: pdpSubmission.provider },
        invoiceId: job.payload.invoiceId,
        jobId: job.id
      });
      await ctx.queue.enqueue(
        JobType.SYNC_STATUS,
        {
          tenantId: job.payload.tenantId,
          invoiceId: job.payload.invoiceId,
          correlationId
        },
        {
          tenantId: job.payload.tenantId,
          correlationId,
          idempotencyKey: buildIdempotencyKey(
            IdempotencyStep.SYNC,
            job.payload.tenantId,
            job.payload.invoiceId
          )
        }
      );
    },
    [JobType.SYNC_STATUS]: async (job) => {
      const correlationId = correlationIdFrom(job);
      const invoice = await getInvoice(ctx.pool, job.payload.tenantId, job.payload.invoiceId);
      if (!invoice) {
        throw new Error("Invoice not found");
      }
      const submission = await getLatestSubmission(
        ctx.pool,
        job.payload.tenantId,
        job.payload.invoiceId
      );
      if (!submission) {
        throw new Error("PDP submission missing");
      }

      const secrets = await getTenantSecrets(ctx.pool, job.payload.tenantId);
      let status;
      try {
        status = await ctx.pdpClient.getStatus(job.payload.tenantId, submission.submission_id, {
          apiKey: secrets.pdpApiKey,
          correlationId,
          idempotencyKey: buildIdempotencyKey(
            IdempotencyStep.SYNC,
            job.payload.tenantId,
            submission.submission_id
          )
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "pdp_status_failed";
        await updatePdpSubmissionStatus(ctx.pool, {
          tenantId: submission.tenant_id,
          provider: submission.provider,
          submissionId: submission.submission_id,
          status: "ERROR",
          lastError: message
        });
        await recordAuditEvent(ctx.pool, {
          tenantId: job.payload.tenantId,
          correlationId,
          actor: "worker",
          eventType: "sync_status.failed",
          payload: { error: message },
          invoiceId: job.payload.invoiceId,
          jobId: job.id
        });
        throw error;
      }
      await updatePdpSubmissionStatus(ctx.pool, {
        tenantId: submission.tenant_id,
        provider: submission.provider,
        submissionId: submission.submission_id,
        status: status.status,
        statusRaw: status.raw ?? null
      });
      const mappedStatus = mapPdpStatusToInvoice(status.status);
      await updateInvoiceStatus(ctx.pool, job.payload.tenantId, job.payload.invoiceId, mappedStatus);

      if (mappedStatus !== "ERROR") {
        await ctx.ghlClient.pushStatus(
          job.payload.tenantId,
          invoice.ghl_invoice_id,
          mappedStatus,
          { apiKey: secrets.ghlApiKey, correlationId }
        );
      }

      await recordAuditEvent(ctx.pool, {
        tenantId: job.payload.tenantId,
        correlationId,
        actor: "worker",
        eventType: "sync_status.completed",
        payload: { status: status.status, mappedStatus },
        invoiceId: job.payload.invoiceId,
        jobId: job.id
      });

      if (isPendingStatus(status.status)) {
        await ctx.queue.enqueue(
          JobType.SYNC_STATUS,
          {
            tenantId: job.payload.tenantId,
            invoiceId: job.payload.invoiceId,
            correlationId
          },
          {
            tenantId: job.payload.tenantId,
            correlationId,
            runAt: computeNextRun(job.attempts),
            idempotencyKey: buildIdempotencyKey(
              IdempotencyStep.SYNC,
              job.payload.tenantId,
              submission.submission_id,
              `retry-${job.attempts}`
            )
          }
        );
      }
    },
    [JobType.RECONCILE_PDP]: async (job) => {
      const correlationId = correlationIdFrom(job);
      const limit = job.payload.limit ?? 25;
      const olderThanMinutes = Number(process.env.PDP_RECONCILE_OLDER_MINUTES ?? 15);
      const pending = await listPendingSubmissions(ctx.pool, {
        tenantId: job.payload.tenantId,
        olderThanMinutes,
        limit
      });

      for (const submission of pending) {
        await ctx.queue.enqueue(
          JobType.SYNC_STATUS,
          {
            tenantId: submission.tenant_id,
            invoiceId: submission.invoice_id,
            correlationId
          },
          {
            tenantId: submission.tenant_id,
            correlationId,
            runAt: new Date(),
            idempotencyKey: buildIdempotencyKey(
              IdempotencyStep.SYNC,
              submission.tenant_id,
              submission.submission_id,
              "reconcile"
            )
          }
        );
      }

      const auditTenantId =
        job.payload.tenantId ?? pending[0]?.tenant_id ?? undefined;
      if (auditTenantId) {
        await recordAuditEvent(ctx.pool, {
          tenantId: auditTenantId,
          correlationId,
          actor: "worker",
          eventType: "pdp.reconcile.completed",
          payload: { count: pending.length },
          jobId: job.id
        });
      } else {
        ctx.logger.info(
          { correlationId, count: pending.length },
          "pdp.reconcile.completed"
        );
      }
    }
  } satisfies Handlers;
}

export async function processOnce(ctx: WorkerContext, workerId: string): Promise<boolean> {
  const job = await ctx.queue.reserveNext(workerId);
  if (!job) {
    return false;
  }
  const handlers = createHandlers(ctx);
  const handler = handlers[job.type as JobType];
  try {
    await handler(job as QueueJob<JobPayloads[JobType]>, ctx);
    await ctx.queue.complete(job.id);
    incCounter("worker_job_completed_total", { type: job.type });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    ctx.logger.error({ jobId: job.id, error: message }, "job.failed");
    await ctx.queue.fail(job.id, message);
    incCounter("worker_job_failed_total", { type: job.type });
  }
  return true;
}

export function startWorker(ctx: WorkerContext, workerId: string, pollIntervalMs: number): void {
  ctx.logger.info({ workerId, pollIntervalMs }, "worker.started");
  const loop = async () => {
    try {
      await processOnce(ctx, workerId);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      ctx.logger.error({ error: message }, "worker.loop_error");
    }
  };
  setInterval(loop, pollIntervalMs);
}
