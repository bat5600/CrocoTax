import type { Pool } from "pg";

export interface PdpSubmissionRecord {
  id: string;
  tenant_id: string;
  invoice_id: string;
  provider: string;
  submission_id: string;
  status: string;
}

export async function upsertPdpSubmission(
  pool: Pool,
  params: {
    tenantId: string;
    invoiceId: string;
    provider: string;
    submissionId: string;
    status: string;
  }
): Promise<void> {
  await pool.query(
    "INSERT INTO pdp_submissions (tenant_id, invoice_id, provider, submission_id, status) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tenant_id, invoice_id, provider) DO UPDATE SET submission_id = EXCLUDED.submission_id, status = EXCLUDED.status, updated_at = now()",
    [params.tenantId, params.invoiceId, params.provider, params.submissionId, params.status]
  );
}

export async function updatePdpSubmissionStatus(
  pool: Pool,
  params: {
    submissionId: string;
    status: string;
  }
): Promise<void> {
  await pool.query(
    "UPDATE pdp_submissions SET status = $1, updated_at = now() WHERE submission_id = $2",
    [params.status, params.submissionId]
  );
}

export async function getLatestSubmission(
  pool: Pool,
  invoiceId: string
): Promise<PdpSubmissionRecord | null> {
  const result = await pool.query<PdpSubmissionRecord>(
    "SELECT id, tenant_id, invoice_id, provider, submission_id, status FROM pdp_submissions WHERE invoice_id = $1 ORDER BY updated_at DESC LIMIT 1",
    [invoiceId]
  );
  return result.rowCount ? result.rows[0] : null;
}
