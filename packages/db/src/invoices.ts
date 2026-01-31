import type { Pool } from "pg";

export interface InvoiceRecord {
  id: string;
  tenant_id: string;
  ghl_invoice_id: string;
  status: string;
  raw_payload: Record<string, unknown> | null;
  canonical_payload: Record<string, unknown> | null;
}

export interface InvoiceListRow {
  id: string;
  tenant_id: string;
  ghl_invoice_id: string;
  status: string;
  created_at: string;
  updated_at: string;
  latest_pdp_status: string | null;
  latest_pdp_provider: string | null;
  latest_pdp_submission_id: string | null;
  latest_pdp_last_error: string | null;
}

export async function listInvoices(
  pool: Pool,
  params: {
    tenantId: string;
    limit: number;
    cursorCreatedAt?: string;
    cursorId?: string;
    status?: string;
    ghlInvoiceId?: string;
  }
): Promise<InvoiceListRow[]> {
  const limit = Math.max(1, Math.min(params.limit, 200));
  const cursorCreatedAt = params.cursorCreatedAt ?? null;
  const cursorId = params.cursorId ?? null;
  const status = params.status ?? null;
  const ghlInvoiceId = params.ghlInvoiceId ?? null;
  const result = await pool.query<InvoiceListRow>(
    `SELECT
       i.id,
       i.tenant_id,
       i.ghl_invoice_id,
       i.status,
       i.created_at,
       i.updated_at,
       ps.status as latest_pdp_status,
       ps.provider as latest_pdp_provider,
       ps.submission_id as latest_pdp_submission_id,
       ps.last_error as latest_pdp_last_error
     FROM invoices i
     LEFT JOIN LATERAL (
       SELECT provider, submission_id, status, last_error
       FROM pdp_submissions
       WHERE invoice_id = i.id AND tenant_id = i.tenant_id
       ORDER BY updated_at DESC
       LIMIT 1
     ) ps ON true
     WHERE i.tenant_id = $1
       AND ($2::text IS NULL OR i.status = $2::text)
       AND ($3::text IS NULL OR i.ghl_invoice_id = $3::text)
       AND (
         $4::timestamptz IS NULL OR
         (i.created_at, i.id) < ($4::timestamptz, $5::uuid)
       )
     ORDER BY i.created_at DESC, i.id DESC
     LIMIT $6`,
    [params.tenantId, status, ghlInvoiceId, cursorCreatedAt, cursorId, limit]
  );
  return result.rows;
}

export async function getInvoice(
  pool: Pool,
  tenantId: string,
  invoiceId: string
): Promise<InvoiceRecord | null> {
  const result = await pool.query<InvoiceRecord>(
    "SELECT id, tenant_id, ghl_invoice_id, status, raw_payload, canonical_payload FROM invoices WHERE id = $1 AND tenant_id = $2",
    [invoiceId, tenantId]
  );
  return result.rowCount ? result.rows[0] : null;
}

export async function updateInvoiceStatus(
  pool: Pool,
  tenantId: string,
  invoiceId: string,
  status: string
): Promise<void> {
  await pool.query(
    "UPDATE invoices SET status = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3",
    [status, invoiceId, tenantId]
  );
}

export async function updateInvoiceRawPayload(
  pool: Pool,
  tenantId: string,
  invoiceId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await pool.query(
    "UPDATE invoices SET raw_payload = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3",
    [payload, invoiceId, tenantId]
  );
}

export async function updateInvoiceCanonicalPayload(
  pool: Pool,
  tenantId: string,
  invoiceId: string,
  payload: Record<string, unknown>
): Promise<void> {
  await pool.query(
    "UPDATE invoices SET canonical_payload = $1, updated_at = now() WHERE id = $2 AND tenant_id = $3",
    [payload, invoiceId, tenantId]
  );
}

export interface InvoiceArtifactsRecord {
  id: string;
  invoice_id: string;
  pdf_key: string | null;
  xml_key: string | null;
  pdf_sha256: string | null;
  xml_sha256: string | null;
}

export async function insertInvoiceArtifacts(
  pool: Pool,
  params: {
    invoiceId: string;
    pdfKey: string;
    xmlKey: string;
    pdfSha256?: string;
    xmlSha256?: string;
  }
): Promise<void> {
  await pool.query(
    "INSERT INTO invoice_artifacts (invoice_id, pdf_key, xml_key, pdf_sha256, xml_sha256) VALUES ($1, $2, $3, $4, $5)",
    [params.invoiceId, params.pdfKey, params.xmlKey, params.pdfSha256 ?? null, params.xmlSha256 ?? null]
  );
}

export async function getLatestArtifacts(
  pool: Pool,
  tenantId: string,
  invoiceId: string
): Promise<InvoiceArtifactsRecord | null> {
  const result = await pool.query<InvoiceArtifactsRecord>(
    "SELECT ia.id, ia.invoice_id, ia.pdf_key, ia.xml_key, ia.pdf_sha256, ia.xml_sha256 FROM invoice_artifacts ia JOIN invoices i ON i.id = ia.invoice_id WHERE ia.invoice_id = $1 AND i.tenant_id = $2 ORDER BY ia.created_at DESC LIMIT 1",
    [invoiceId, tenantId]
  );
  return result.rowCount ? result.rows[0] : null;
}

export interface InvoiceDetailsRow extends InvoiceListRow {
  raw_payload: Record<string, unknown> | null;
  canonical_payload: Record<string, unknown> | null;
  latest_pdf_key: string | null;
  latest_xml_key: string | null;
  latest_pdf_sha256: string | null;
  latest_xml_sha256: string | null;
  latest_pdp_status_raw: Record<string, unknown> | null;
}

export async function getInvoiceDetails(
  pool: Pool,
  params: { tenantId: string; invoiceId: string }
): Promise<InvoiceDetailsRow | null> {
  const result = await pool.query<InvoiceDetailsRow>(
    `SELECT
       i.id,
       i.tenant_id,
       i.ghl_invoice_id,
       i.status,
       i.created_at,
       i.updated_at,
       i.raw_payload,
       i.canonical_payload,
       ps.status as latest_pdp_status,
       ps.provider as latest_pdp_provider,
       ps.submission_id as latest_pdp_submission_id,
       ps.last_error as latest_pdp_last_error,
       ps.status_raw as latest_pdp_status_raw,
       ia.pdf_key as latest_pdf_key,
       ia.xml_key as latest_xml_key,
       ia.pdf_sha256 as latest_pdf_sha256,
       ia.xml_sha256 as latest_xml_sha256
     FROM invoices i
     LEFT JOIN LATERAL (
       SELECT provider, submission_id, status, last_error, status_raw
       FROM pdp_submissions
       WHERE invoice_id = i.id AND tenant_id = i.tenant_id
       ORDER BY updated_at DESC
       LIMIT 1
     ) ps ON true
     LEFT JOIN LATERAL (
       SELECT pdf_key, xml_key, pdf_sha256, xml_sha256
       FROM invoice_artifacts
       WHERE invoice_id = i.id
       ORDER BY created_at DESC
       LIMIT 1
     ) ia ON true
     WHERE i.tenant_id = $1 AND i.id = $2`,
    [params.tenantId, params.invoiceId]
  );
  return result.rowCount ? result.rows[0] : null;
}
