import { Pool } from "pg";
import { JobPayloads, JobType } from "@croco/core";

export interface QueueJob<T = unknown> {
  id: string;
  type: JobType;
  payload: T;
  tenantId?: string;
  correlationId?: string;
  attempts: number;
  maxAttempts: number;
}

export interface EnqueueOptions {
  idempotencyKey?: string;
  runAt?: Date;
  tenantId?: string;
  correlationId?: string;
}

export interface JobQueue {
  enqueue<K extends JobType>(
    type: K,
    payload: JobPayloads[K],
    options?: EnqueueOptions
  ): Promise<{ id?: string; enqueued: boolean }>;
  reserveNext(workerId: string): Promise<QueueJob | null>;
  complete(jobId: string): Promise<void>;
  fail(jobId: string, error: string): Promise<void>;
}

export interface LoggerLike {
  info: (obj: Record<string, unknown>, msg?: string) => void;
  error: (obj: Record<string, unknown>, msg?: string) => void;
}

export class DbQueue implements JobQueue {
  private pool: Pool;
  private logger?: LoggerLike;

  constructor(pool: Pool, logger?: LoggerLike) {
    this.pool = pool;
    this.logger = logger;
  }

  async enqueue<K extends JobType>(
    type: K,
    payload: JobPayloads[K],
    options?: EnqueueOptions
  ): Promise<{ id?: string; enqueued: boolean }> {
    const result = await this.pool.query(
      "INSERT INTO jobs (tenant_id, type, payload, status, run_at, idempotency_key, correlation_id) VALUES ($1, $2, $3, 'queued', $4, $5, $6) ON CONFLICT (tenant_id, type, idempotency_key) DO NOTHING RETURNING id",
      [
        options?.tenantId ?? null,
        type,
        payload,
        options?.runAt ?? new Date(),
        options?.idempotencyKey ?? null,
        options?.correlationId ?? null
      ]
    );
    const enqueued = result.rowCount === 1;
    if (!enqueued) {
      this.logger?.info({ type, idempotencyKey: options?.idempotencyKey }, "job.skipped_duplicate");
      return { enqueued: false };
    }
    return { id: result.rows[0].id, enqueued: true };
  }

  async reserveNext(workerId: string): Promise<QueueJob | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "SELECT * FROM jobs WHERE status = 'queued' AND run_at <= now() ORDER BY run_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED"
      );
      if (result.rowCount === 0) {
        await client.query("ROLLBACK");
        return null;
      }
      const row = result.rows[0];
      await client.query(
        "UPDATE jobs SET status = 'running', attempts = attempts + 1, locked_at = now(), locked_by = $1, updated_at = now() WHERE id = $2",
        [workerId, row.id]
      );
      await client.query("COMMIT");
      return {
        id: row.id,
        type: row.type,
        payload: row.payload,
        tenantId: row.tenant_id ?? undefined,
        correlationId: row.correlation_id ?? undefined,
        attempts: row.attempts + 1,
        maxAttempts: row.max_attempts
      } as QueueJob;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async complete(jobId: string): Promise<void> {
    await this.pool.query(
      "UPDATE jobs SET status = 'completed', updated_at = now() WHERE id = $1",
      [jobId]
    );
  }

  async fail(jobId: string, error: string): Promise<void> {
    const result = await this.pool.query(
      "SELECT attempts, max_attempts FROM jobs WHERE id = $1",
      [jobId]
    );
    if (result.rowCount === 0) {
      return;
    }
    const { attempts, max_attempts } = result.rows[0];
    const shouldRetry = attempts < max_attempts;
    const nextRun = new Date(Date.now() + Math.pow(2, attempts) * 1000);
    await this.pool.query(
      "UPDATE jobs SET status = $1, run_at = $2, last_error = $3, updated_at = now() WHERE id = $4",
      [shouldRetry ? "queued" : "failed", nextRun, error, jobId]
    );
  }
}
