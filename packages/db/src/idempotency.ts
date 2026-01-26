import { Pool } from "pg";
import { IdempotencyStep } from "@croco/core";

export async function insertIdempotencyKey(
  pool: Pool,
  params: {
    tenantId: string;
    step: IdempotencyStep;
    key: string;
    invoiceId?: string;
    correlationId?: string;
  }
): Promise<boolean> {
  const result = await pool.query(
    "INSERT INTO idempotency_keys (tenant_id, step, idempotency_key, invoice_id, correlation_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id",
    [params.tenantId, params.step, params.key, params.invoiceId ?? null, params.correlationId ?? null]
  );
  return result.rowCount === 1;
}
