import { CanonicalInvoice } from "@croco/core";
export interface PdpArtifactPayload {
  key: string;
  sha256?: string;
  base64?: string;
}

export interface PdpArtifactsPayload {
  pdf: PdpArtifactPayload;
  xml: PdpArtifactPayload;
}

export interface PdpSubmission {
  provider: string;
  submissionId: string;
  status: string;
}

export interface PdpStatus {
  status: string;
  raw?: Record<string, unknown>;
}

export interface PdpRequestOptions {
  apiKey?: string;
  correlationId?: string;
  idempotencyKey?: string;
}

export interface PdpClient {
  submit(
    tenantId: string,
    invoice: CanonicalInvoice,
    artifacts: PdpArtifactsPayload,
    options?: PdpRequestOptions
  ): Promise<PdpSubmission>;
  getStatus(
    tenantId: string,
    submissionId: string,
    options?: PdpRequestOptions
  ): Promise<PdpStatus>;
}
