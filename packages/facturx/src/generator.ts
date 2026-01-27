import { createHash } from "crypto";
import { mkdirSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { CanonicalInvoice } from "@croco/core";
import { buildCiiXml } from "./cii";

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function buildMinimalPdf(text: string): Buffer {
  const header = "%PDF-1.4\n";
  const objects: string[] = [];

  const content = `BT\n/F1 18 Tf\n50 700 Td\n(${text}) Tj\nET\n`;
  const contentObj = `4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`;

  objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  objects.push(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n"
  );
  objects.push(contentObj);
  objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  let offset = Buffer.byteLength(header);
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(offset);
    offset += Buffer.byteLength(obj);
  }

  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (const objOffset of offsets.slice(1)) {
    xref += `${objOffset.toString().padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF\n`;

  const body = objects.join("");
  return Buffer.from(header + body + xref + trailer, "utf8");
}

export interface FacturxArtifacts {
  pdfPath: string;
  xmlPath: string;
  pdfSha256?: string;
  xmlSha256?: string;
}

export async function generateFacturxStub(
  invoice: CanonicalInvoice
): Promise<FacturxArtifacts> {
  const tmpBase = join(tmpdir(), "facturx");
  mkdirSync(tmpBase, { recursive: true });
  const dir = join(tmpBase, `${invoice.tenantId}-${invoice.invoiceNumber}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });

  const xmlContent = buildCiiXml(invoice);
  const xmlBuffer = Buffer.from(xmlContent, "utf8");
  const pdfBuffer = buildMinimalPdf(`Invoice ${invoice.invoiceNumber}`);

  const pdfPath = join(dir, "facturx.pdf");
  const xmlPath = join(dir, "facturx.xml");

  writeFileSync(pdfPath, pdfBuffer);
  writeFileSync(xmlPath, xmlBuffer);

  return {
    pdfPath,
    xmlPath,
    pdfSha256: sha256(pdfBuffer),
    xmlSha256: sha256(xmlBuffer)
  };
}
