import { readFileSync } from "fs";
import { join } from "path";
import { execFileSync } from "child_process";
import { createFacturxGenerator } from "@croco/facturx";
import { CanonicalInvoice } from "@croco/core";
import { loadEnvFile } from "@croco/config";

async function run(): Promise<void> {
  loadEnvFile();
  const fixturePath = join(process.cwd(), "fixtures", "canonical-invoice.json");
  const raw = readFileSync(fixturePath, "utf8");
  const invoice = JSON.parse(raw) as CanonicalInvoice;

  const generator = createFacturxGenerator();
  const artifacts = await generator.generate(invoice);

  const validatePdfa = process.env.VERAPDF_VALIDATE === "1";
  if (validatePdfa) {
    const veraPdfBin = process.env.VERAPDF_BIN ?? "verapdf";
    try {
      execFileSync(veraPdfBin, [artifacts.pdfPath], { stdio: "inherit" });
    } catch (error) {
      throw new Error(
        "PDF/A validation failed. Ensure veraPDF is installed and VERAPDF_BIN is set if not on PATH."
      );
    }
  }

  // eslint-disable-next-line no-console
  console.log("Factur-X artifacts:");
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(artifacts, null, 2));
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
