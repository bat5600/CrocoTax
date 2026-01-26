import { CanonicalInvoice } from "@croco/core";
import { FacturxArtifacts } from "@croco/facturx";

export interface PdpSubmission {
  provider: string;
  submissionId: string;
  status: string;
}

export interface PdpStatus {
  status: string;
  raw?: Record<string, unknown>;
}

export interface PdpClient {
  submit(tenantId: string, invoice: CanonicalInvoice, artifacts: FacturxArtifacts): Promise<PdpSubmission>;
  getStatus(tenantId: string, submissionId: string): Promise<PdpStatus>;
}

export function createPdpClient(): PdpClient {
  return {
    async submit(_tenantId: string, _invoice: CanonicalInvoice, _artifacts: FacturxArtifacts): Promise<PdpSubmission> {
      throw new Error("PDP client not implemented");
    },
    async getStatus(_tenantId: string, _submissionId: string): Promise<PdpStatus> {
      throw new Error("PDP client not implemented");
    }
  };
}
