import { CanonicalInvoice } from "@croco/core";
import { PdpArtifactsPayload, PdpClient, PdpRequestOptions, PdpStatus, PdpSubmission } from "./types";

export interface HttpPdpConfig {
  baseUrl: string;
  apiKey?: string;
  provider: string;
  artifactMode?: "base64" | "keys";
}

export function createHttpPdpClient(config: HttpPdpConfig): PdpClient {
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const artifactMode = config.artifactMode ?? "base64";

  function buildHeaders(options?: PdpRequestOptions): Record<string, string> {
    const apiKey = options?.apiKey ?? config.apiKey;
    const headers: Record<string, string> = {
      "Content-Type": "application/json"
    };
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

  return {
    async submit(
      tenantId: string,
      invoice: CanonicalInvoice,
      artifacts: PdpArtifactsPayload,
      options?: PdpRequestOptions
    ): Promise<PdpSubmission> {
      if (artifactMode === "base64") {
        if (!artifacts.pdf.base64 || !artifacts.xml.base64) {
          throw new Error("PDP artifact mode base64 requires pdf/xml base64 content");
        }
      }
      const payload = {
        tenantId,
        invoice,
        artifacts: {
          pdf: {
            key: artifacts.pdf.key,
            sha256: artifacts.pdf.sha256,
            base64: artifactMode === "base64" ? artifacts.pdf.base64 : undefined
          },
          xml: {
            key: artifacts.xml.key,
            sha256: artifacts.xml.sha256,
            base64: artifactMode === "base64" ? artifacts.xml.base64 : undefined
          }
        }
      };
      const response = await fetch(`${baseUrl}/submissions`, {
        method: "POST",
        headers: buildHeaders(options),
        body: JSON.stringify(payload)
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
    async getStatus(
      _tenantId: string,
      submissionId: string,
      options?: PdpRequestOptions
    ): Promise<PdpStatus> {
      const response = await fetch(`${baseUrl}/submissions/${submissionId}`, {
        headers: buildHeaders(options)
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
