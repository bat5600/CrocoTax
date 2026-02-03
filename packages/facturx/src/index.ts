import { CanonicalInvoice } from "@croco/core";
import { FacturxArtifacts, generateFacturxCli, generateFacturxStub } from "./generator";
import { renderInvoicePdf } from "./render/pdf";
import { computeInvoiceTotals } from "./totals";

export interface FacturxGenerator {
  generate(input: CanonicalInvoice): Promise<FacturxArtifacts>;
}

export function createFacturxGenerator(): FacturxGenerator {
  const mode = process.env.FACTURX_MODE ?? "stub";
  return {
    async generate(input: CanonicalInvoice): Promise<FacturxArtifacts> {
      if (mode === "stub") {
        return generateFacturxStub(input);
      }
      if (mode === "cli") {
        return generateFacturxCli(input);
      }
      throw new Error(`Factur-X generation mode not supported: ${mode}`);
    }
  };
}

export type { FacturxArtifacts } from "./generator";
export * from "./cii";
export { renderInvoicePdf, computeInvoiceTotals };
