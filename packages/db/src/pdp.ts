import type { Pool } from "pg";

export interface PdpSubmissionRecord {
  id: string;
  tenant_id: string;
  invoice_id: string;
  provider: string;
  submission_id: string;
  status: string;
  status_raw?: Record<string, unknown> | null;
  last_error?: string | null;
  last_checked_at?: string | null;
}

export async function upsertPdpSubmission(
  pool: Pool,
  params: {
    tenantId: string;
    invoiceId: string;
    provider: string;
    submissionId: string;
    status: string;
    statusRaw?: Record<string, unknown> | null;
  }
): Promise<void> {
  await pool.query(
    "INSERT INTO pdp_submissions (tenant_id, invoice_id, provider, submission_id, status, status_raw, last_checked_at) VALUES ($1, $2, $3, $4, $5, $6, now()) ON CONFLICT (tenant_id, invoice_id, provider) DO UPDATE SET submission_id = EXCLUDED.submission_id, status = EXCLUDED.status, status_raw = EXCLUDED.status_raw, last_checked_at = now(), updated_at = now()",
    [
      params.tenantId,
      params.invoiceId,
      params.provider,
      params.submissionId,
      params.status,
      params.statusRaw ?? null
    ]
  );
}

export async function updatePdpSubmissionStatus(
  pool: Pool,
  params: {
    tenantId: string;
    provider: string;
    submissionId: string;
    status: string;
    statusRaw?: Record<string, unknown> | null;
    lastError?: string | null;
  }
): Promise<void> {
  await pool.query(
    "UPDATE pdp_submissions SET status = $1, status_raw = $2, last_error = $3, last_checked_at = now(), updated_at = now() WHERE submission_id = $4 AND tenant_id = $5 AND provider = $6",
    [
      params.status,
      params.statusRaw ?? null,
      params.lastError ?? null,
      params.submissionId,
      params.tenantId,
      params.provider
    ]
  );
}

export async function getLatestSubmission(
  pool: Pool,
  tenantId: string,
  invoiceId: string
): Promise<PdpSubmissionRecord | null> {
  const result = await pool.query<PdpSubmissionRecord>(
    "SELECT id, tenant_id, invoice_id, provider, submission_id, status, status_raw, last_error, last_checked_at FROM pdp_submissions WHERE invoice_id = $1 AND tenant_id = $2 ORDER BY updated_at DESC LIMIT 1",
    [invoiceId, tenantId]
  );
  return result.rowCount ? result.rows[0] : null;
}

export async function listPendingSubmissions(
  pool: Pool,
  params: {
    tenantId?: string;
    olderThanMinutes: number;
    limit: number;
  }
): Promise<PdpSubmissionRecord[]> {
  const conditions = ["status IN ('SUBMITTED', 'PROCESSING', 'PENDING', 'SYNCED')"];
  const values: Array<string | number> = [params.olderThanMinutes, params.limit];
  let idx = values.length;
  let tenantFilter = "";
  if (params.tenantId) {
    idx += 1;
    values.push(params.tenantId);
    tenantFilter = ` AND tenant_id = $${idx}`;
  }
  const result = await pool.query<PdpSubmissionRecord>(
    `SELECT id, tenant_id, invoice_id, provider, submission_id, status, status_raw, last_error, last_checked_at
     FROM pdp_submissions
     WHERE ${conditions.join(" AND ")} AND (last_checked_at IS NULL OR last_checked_at < now() - ($1::text || ' minutes')::interval)${tenantFilter}
     ORDER BY last_checked_at NULLS FIRST, updated_at ASC
     LIMIT $2`,
    values
  );
  return result.rows;
}
