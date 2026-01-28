import { z } from "zod";
import { createHmac, timingSafeEqual } from "crypto";

export const GhlInvoiceSchema = z.record(z.unknown());
export type GhlInvoice = z.infer<typeof GhlInvoiceSchema>;

export interface GhlRequestOptions {
  apiKey?: string;
  correlationId?: string;
}

export interface GhlClient {
  fetchInvoice(
    tenantId: string,
    invoiceId: string,
    options?: GhlRequestOptions
  ): Promise<GhlInvoice>;
  pushStatus(
    tenantId: string,
    invoiceId: string,
    status: string,
    options?: GhlRequestOptions
  ): Promise<void>;
}

export function createGhlClient(): GhlClient {
  const baseUrl = process.env.GHL_API_BASE;

  return {
    async fetchInvoice(
      _tenantId: string,
      invoiceId: string,
      options?: GhlRequestOptions
    ): Promise<GhlInvoice> {
      const apiKey = options?.apiKey;
      if (!baseUrl || !apiKey) {
        return {};
      }

      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/invoices/${invoiceId}`,
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            ...(options?.correlationId ? { "X-Correlation-Id": options.correlationId } : {})
          }
        }
      );
      if (!response.ok) {
        throw new Error(`GHL fetch failed: ${response.status}`);
      }
      return (await response.json()) as GhlInvoice;
    },
    async pushStatus(
      _tenantId: string,
      invoiceId: string,
      status: string,
      options?: GhlRequestOptions
    ): Promise<void> {
      const apiKey = options?.apiKey;
      if (!baseUrl || !apiKey) {
        return;
      }
      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/invoices/${invoiceId}/status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(options?.correlationId ? { "X-Correlation-Id": options.correlationId } : {})
        },
        body: JSON.stringify({ status })
      });
      if (!response.ok) {
        throw new Error(`GHL status update failed: ${response.status}`);
      }
    }
  };
}

export function verifyWebhook(signature: string | undefined, rawBody: string, secret: string | undefined): boolean {
  if (!secret || !signature) {
    return true;
  }
  try {
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(signature, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length) {
      return false;
    }
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export * from "./mapper";
