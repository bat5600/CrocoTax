import { CanonicalInvoice } from "@croco/core";
import { FacturxArtifacts } from "@croco/facturx";
import { PdpClient, PdpStatus, PdpSubmission } from "./types";

export interface HttpPdpConfig {
  baseUrl: string;
  apiKey?: string;
  provider: string;
}

export function createHttpPdpClient(config: HttpPdpConfig): PdpClient {
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const headers = config.apiKey
    ? {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json"
      }
    : { "Content-Type": "application/json" };

  return {
    async submit(_tenantId: string, invoice: CanonicalInvoice, artifacts: FacturxArtifacts): Promise<PdpSubmission> {
      const response = await fetch(`${baseUrl}/submissions`, {
        method: "POST",
        headers,
        body: JSON.stringify({ invoice, artifacts })
      });
      if (!response.ok) {
        throw new Error(`PDP submit failed: ${response.status}`);
      }
      const data = (await response.json()) as { submissionId: string; status?: string };
      return {
        provider: config.provider,
        submissionId: data.submissionId,
        status: data.status ?? "SUBMITTED"
      };
    },
    async getStatus(_tenantId: string, submissionId: string): Promise<PdpStatus> {
      const response = await fetch(`${baseUrl}/submissions/${submissionId}`, {
        headers
      });
      if (!response.ok) {
        throw new Error(`PDP status failed: ${response.status}`);
      }
      const data = (await response.json()) as { status: string; raw?: Record<string, unknown> };
      return {
        status: data.status,
        raw: data.raw
      };
    }
  };
}
