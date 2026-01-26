export type TenantId = string;
export type CorrelationId = string;

export type InvoiceStatus =
  | "NEW"
  | "FETCHED"
  | "MAPPED"
  | "GENERATED"
  | "SUBMITTED"
  | "SYNCED"
  | "ERROR";

export interface CanonicalInvoice {
  id?: string;
  tenantId: TenantId;
  invoiceNumber: string;
  issueDate: string;
  currency: string;
  totalAmount: number;
  buyer: {
    name: string;
    country: string;
  };
  seller: {
    name: string;
    country: string;
  };
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
  }>;
}

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
