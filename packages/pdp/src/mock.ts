import { randomUUID } from "crypto";
import { CanonicalInvoice } from "@croco/core";
import { PdpArtifactsPayload, PdpClient, PdpStatus, PdpSubmission } from "./types";

export function createMockPdpClient(): PdpClient {
  return {
    async submit(
      _tenantId: string,
      _invoice: CanonicalInvoice,
      _artifacts: PdpArtifactsPayload,
      _options?: { apiKey?: string; correlationId?: string; idempotencyKey?: string }
    ): Promise<PdpSubmission> {
      return {
        provider: "mock",
        submissionId: `mock-${randomUUID()}`,
        status: "SUBMITTED"
      };
    },
    async getStatus(
      _tenantId: string,
      _submissionId: string,
      _options?: { apiKey?: string; correlationId?: string; idempotencyKey?: string }
    ): Promise<PdpStatus> {
      return {
        status: "ACCEPTED",
        raw: { source: "mock" }
      };
    }
  };
}
