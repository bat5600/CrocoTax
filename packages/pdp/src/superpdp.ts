import { CanonicalInvoice } from "@croco/core";
import { PdpArtifactsPayload, PdpClient, PdpRequestOptions, PdpStatus, PdpSubmission } from "./types";

export interface SuperPdpConfig {
  baseUrl: string;
  apiKey?: string;
  provider: string;
}

interface SuperPdpInvoice {
  id: number;
  direction?: "in" | "out";
  company_id?: number;
  created_at?: string;
}

interface SuperPdpEvent {
  id: number;
  invoice_id: number;
  status_code: string;
  status_text: string;
  created_at: string;
  data?: Record<string, unknown>;
}

interface SuperPdpListEventsResponse {
  data: SuperPdpEvent[];
  has_after: boolean;
}

function buildHeaders(
  config: SuperPdpConfig,
  options?: PdpRequestOptions,
  extra?: Record<string, string>
): Record<string, string> {
  const apiKey = options?.apiKey ?? config.apiKey;
  const headers: Record<string, string> = { ...(extra ?? {}) };

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (options?.correlationId) {
    headers["X-Correlation-Id"] = options.correlationId;
  }
  if (options?.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  return headers;
}

function normalizeStatus(statusCode: string, statusText: string): string {
  const code = statusCode.toLowerCase();
  if (code === "api:accepted") return "ACCEPTED";
  if (code === "api:rejected" || code === "api:invalid") return "REJECTED";
  if (code === "fr:212") return "PAID";

  const text = statusText.toLowerCase();
  if (/(paid|payé|payee|payée|paiement|encaiss)/.test(text)) return "PAID";
  if (/(accept|accepté|accepte|acceptée)/.test(text)) return "ACCEPTED";
  if (/(reject|rejet|rejeté|rejetée|refus|refusé|refusée|invalid|invalide)/.test(text)) {
    return "REJECTED";
  }

  return "PROCESSING";
}

export function createSuperPdpClient(config: SuperPdpConfig): PdpClient {
  const baseUrl = config.baseUrl.replace(/\/$/, "");

  return {
    async submit(
      _tenantId: string,
      _invoice: CanonicalInvoice,
      artifacts: PdpArtifactsPayload,
      options?: PdpRequestOptions
    ): Promise<PdpSubmission> {
      const pdfBase64 = artifacts.pdf.base64;
      const xmlBase64 = artifacts.xml.base64;
      if (!pdfBase64 && !xmlBase64) {
        throw new Error(
          "SUPER PDP submit requires PDF or XML base64 artifacts (set PDP_ARTIFACT_MODE=base64)"
        );
      }

      let response: Response;
      if (pdfBase64) {
        const pdfBuffer = Buffer.from(pdfBase64, "base64");
        const form = new FormData();
        form.append(
          "file_name",
          new Blob([pdfBuffer], { type: "application/pdf" }),
          "facturx.pdf"
        );
        response = await fetch(`${baseUrl}/v1.beta/invoices`, {
          method: "POST",
          headers: buildHeaders(config, options),
          body: form
        });
      } else {
        const xml = Buffer.from(xmlBase64 as string, "base64").toString("utf8");
        response = await fetch(`${baseUrl}/v1.beta/invoices`, {
          method: "POST",
          headers: buildHeaders(config, options, { "Content-Type": "application/xml" }),
          body: xml
        });
      }

      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`SUPER PDP submit failed: ${response.status}${text ? ` - ${text}` : ""}`);
      }
      const data = (await response.json()) as SuperPdpInvoice;
      if (!data?.id) {
        throw new Error("SUPER PDP submit failed: missing invoice id in response");
      }

      return {
        provider: config.provider,
        submissionId: String(data.id),
        status: "SUBMITTED"
      };
    },

    async getStatus(
      _tenantId: string,
      submissionId: string,
      options?: PdpRequestOptions
    ): Promise<PdpStatus> {
      if (!/^[0-9]+$/.test(submissionId)) {
        throw new Error("SUPER PDP status failed: submissionId must be an integer");
      }

      const url = new URL(`${baseUrl}/v1.beta/invoice_events`);
      url.searchParams.set("invoice_id", submissionId);
      url.searchParams.set("limit", "1000");

      const response = await fetch(url.toString(), {
        headers: buildHeaders(config, options, { Accept: "application/json" })
      });
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(`SUPER PDP status failed: ${response.status}${text ? ` - ${text}` : ""}`);
      }

      const payload = (await response.json()) as SuperPdpListEventsResponse;
      const events = Array.isArray(payload?.data) ? payload.data : [];
      const latest = events.length > 0 ? events[events.length - 1] : null;
      if (!latest) {
        return {
          status: "PROCESSING",
          raw: { provider: config.provider, invoice_id: submissionId, events: [] }
        };
      }

      return {
        status: normalizeStatus(latest.status_code, latest.status_text),
        raw: { provider: config.provider, invoice_id: submissionId, latest_event: latest }
      };
    }
  };
}
