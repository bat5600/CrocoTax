import { randomUUID } from "crypto";
import { CanonicalInvoice } from "@croco/core";
import { FacturxArtifacts } from "@croco/facturx";
import { PdpClient, PdpStatus, PdpSubmission } from "./types";

export function createMockPdpClient(): PdpClient {
  return {
    async submit(_tenantId: string, _invoice: CanonicalInvoice, _artifacts: FacturxArtifacts): Promise<PdpSubmission> {
      return {
        provider: "mock",
        submissionId: `mock-${randomUUID()}`,
        status: "SUBMITTED"
      };
    },
    async getStatus(_tenantId: string, _submissionId: string): Promise<PdpStatus> {
      return {
        status: "ACCEPTED",
        raw: { source: "mock" }
      };
    }
  };
}
