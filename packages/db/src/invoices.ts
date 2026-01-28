import type { Pool } from "pg";

export interface InvoiceRecord {
  id: string;
  tenant_id: string;
  ghl_invoice_id: string;
  status: string;
  raw_payload: Record<string, unknown> | null;
  canonical_payload: Record<string, unknown> | null;
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
