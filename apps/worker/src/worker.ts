import { Pool } from "pg";
import { randomUUID } from "crypto";
import { JobQueue, QueueJob } from "@croco/queue";
import { JobPayloads, JobType, IdempotencyStep, buildIdempotencyKey } from "@croco/core";
import { recordAuditEvent } from "@croco/audit";
import { Logger } from "@croco/observability";

export interface WorkerContext {
  pool: Pool;
  queue: JobQueue;
  logger: Logger;
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

async function updateInvoiceStatus(pool: Pool, invoiceId: string, status: string): Promise<void> {
  await pool.query("UPDATE invoices SET status = $1, updated_at = now() WHERE id = $2", [
    status,
    invoiceId
  ]);
}

export function createHandlers(ctx: WorkerContext): Handlers {
  return {
    [JobType.FETCH_INVOICE]: async (job) => {
      const correlationId = correlationIdFrom(job);
      await updateInvoiceStatus(ctx.pool, job.payload.invoiceId, "FETCHED");
      await recordAuditEvent(ctx.pool, {
        tenantId: job.payload.tenantId,
        correlationId,
        actor: "worker",
        eventType: "fetch_invoice.completed",
        payload: { ghlInvoiceId: job.payload.ghlInvoiceId },
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
      await updateInvoiceStatus(ctx.pool, job.payload.invoiceId, "MAPPED");
      await recordAuditEvent(ctx.pool, {
        tenantId: job.payload.tenantId,
        correlationId,
        actor: "worker",
        eventType: "map_canonical.completed",
        payload: {},
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
      await updateInvoiceStatus(ctx.pool, job.payload.invoiceId, "GENERATED");
      await recordAuditEvent(ctx.pool, {
        tenantId: job.payload.tenantId,
        correlationId,
        actor: "worker",
        eventType: "generate_facturx.completed",
        payload: {},
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
      await updateInvoiceStatus(ctx.pool, job.payload.invoiceId, "SUBMITTED");
      await recordAuditEvent(ctx.pool, {
        tenantId: job.payload.tenantId,
        correlationId,
        actor: "worker",
        eventType: "submit_pdp.completed",
        payload: {},
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
      await updateInvoiceStatus(ctx.pool, job.payload.invoiceId, "SYNCED");
      await recordAuditEvent(ctx.pool, {
        tenantId: job.payload.tenantId,
        correlationId,
        actor: "worker",
        eventType: "sync_status.completed",
        payload: {},
        invoiceId: job.payload.invoiceId,
        jobId: job.id
      });
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    ctx.logger.error({ jobId: job.id, error: message }, "job.failed");
    await ctx.queue.fail(job.id, message);
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
