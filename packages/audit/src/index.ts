import { Pool } from "pg";
import { AuditEvent } from "@croco/core";
import { createHash } from "crypto";

export async function recordAuditEvent(pool: Pool, event: AuditEvent): Promise<void> {
  const payloadString = JSON.stringify(event.payload ?? {});
  const payloadHash = createHash("sha256").update(payloadString).digest("hex");
  await pool.query(
    "INSERT INTO audit_log (tenant_id, correlation_id, actor, event_type, payload, payload_hash, invoice_id, job_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
    [
      event.tenantId,
      event.correlationId,
      event.actor,
      event.eventType,
      event.payload,
      payloadHash,
      event.invoiceId ?? null,
      event.jobId ?? null
    ]
  );
}
