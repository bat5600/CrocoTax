import { CanonicalInvoice } from "@croco/core";

export interface FacturxArtifacts {
  pdfPath: string;
  xmlPath: string;
  pdfSha256?: string;
  xmlSha256?: string;
}

export interface FacturxGenerator {
  generate(input: CanonicalInvoice): Promise<FacturxArtifacts>;
}

export function createFacturxGenerator(): FacturxGenerator {
  return {
    async generate(_input: CanonicalInvoice): Promise<FacturxArtifacts> {
      throw new Error("Factur-X generation not implemented");
    }
  };
}
