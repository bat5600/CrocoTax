import type { Pool } from "pg";

export interface AuditLogRow {
  id: string;
  tenant_id: string;
  correlation_id: string;
  actor: string;
  event_type: string;
  payload: Record<string, unknown>;
  payload_hash: string;
  invoice_id: string | null;
  job_id: string | null;
  created_at: string;
}

export async function listAuditEventsForInvoice(
  pool: Pool,
  params: { tenantId: string; invoiceId: string; limit: number }
): Promise<AuditLogRow[]> {
  const limit = Math.max(1, Math.min(params.limit, 500));
  const result = await pool.query<AuditLogRow>(
    "SELECT id, tenant_id, correlation_id, actor, event_type, payload, payload_hash, invoice_id, job_id, created_at FROM audit_log WHERE tenant_id = $1 AND invoice_id = $2 ORDER BY created_at DESC LIMIT $3",
    [params.tenantId, params.invoiceId, limit]
  );
  return result.rows;
}

