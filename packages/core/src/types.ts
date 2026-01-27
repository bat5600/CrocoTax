export type TenantId = string;
export type CorrelationId = string;

export type InvoiceStatus =
  | "NEW"
  | "FETCHED"
  | "MAPPED"
  | "GENERATED"
  | "SUBMITTED"
  | "SYNCED"
  | "ACCEPTED"
  | "REJECTED"
  | "PAID"
  | "ERROR";

export interface AuditEvent {
  tenantId: TenantId;
  correlationId: CorrelationId;
  actor: string;
  eventType: string;
  payload: Record<string, unknown>;
  invoiceId?: string;
  jobId?: string;
}

export interface Tenant {
  id: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
}
