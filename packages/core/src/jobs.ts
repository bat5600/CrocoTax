export const JobType = {
  FETCH_INVOICE: "FETCH_INVOICE",
  MAP_CANONICAL: "MAP_CANONICAL",
  GENERATE_FACTURX: "GENERATE_FACTURX",
  SUBMIT_PDP: "SUBMIT_PDP",
  SYNC_STATUS: "SYNC_STATUS"
} as const;

export type JobType = (typeof JobType)[keyof typeof JobType];

export interface JobPayloads {
  FETCH_INVOICE: {
    tenantId: string;
    invoiceId: string;
    ghlInvoiceId: string;
    correlationId: string;
  };
  MAP_CANONICAL: {
    tenantId: string;
    invoiceId: string;
    correlationId: string;
  };
  GENERATE_FACTURX: {
    tenantId: string;
    invoiceId: string;
    correlationId: string;
  };
  SUBMIT_PDP: {
    tenantId: string;
    invoiceId: string;
    correlationId: string;
  };
  SYNC_STATUS: {
    tenantId: string;
    invoiceId: string;
    correlationId: string;
  };
}
