import { z } from "zod";

export const GhlInvoiceSchema = z.record(z.unknown());
export type GhlInvoice = z.infer<typeof GhlInvoiceSchema>;

export interface GhlClient {
  fetchInvoice(tenantId: string, invoiceId: string): Promise<GhlInvoice>;
  pushStatus(tenantId: string, invoiceId: string, status: string): Promise<void>;
}

export function createGhlClient(): GhlClient {
  return {
    async fetchInvoice(_tenantId: string, _invoiceId: string): Promise<GhlInvoice> {
      return {};
    },
    async pushStatus(_tenantId: string, _invoiceId: string, _status: string): Promise<void> {
      return;
    }
  };
}

export function verifyWebhook(_signature: string | undefined, _rawBody: string, _secret: string | undefined): boolean {
  return true;
}
