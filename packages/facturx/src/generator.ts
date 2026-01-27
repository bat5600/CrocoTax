import { execFileSync } from "child_process";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
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

function ensureTool(binary: string): void {
  try {
    execFileSync(binary, ["--version"], { stdio: "ignore" });
  } catch (error) {
    throw new Error(
      `Missing required binary "${binary}". Install it and ensure it is on PATH.`
    );
  }
}

function resolveIccProfile(): string {
  const candidates = [
    process.env.PDFA_ICC_PROFILE,
    "/usr/share/color/icc/ghostscript/srgb.icc",
    "/usr/share/color/icc/ghostscript/sRGB.icc",
    "/usr/share/ghostscript/iccprofiles/srgb.icc",
    "/usr/share/color/icc/sRGB.icc"
  ];
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }
  throw new Error(
    "Missing ICC profile for PDF/A-3 conversion. Set PDFA_ICC_PROFILE to a valid sRGB .icc file."
  );
}

function runGhostscriptPdfA(inputPdf: string, outputPdf: string, iccPath: string): void {
  const args = [
    "-dPDFA=3",
    "-dBATCH",
    "-dNOPAUSE",
    "-dNOOUTERSAVE",
    "-sDEVICE=pdfwrite",
    "-sColorConversionStrategy=RGB",
    "-sProcessColorModel=DeviceRGB",
    "-dUseCIEColor",
    "-dPDFACompatibilityPolicy=1",
    `-sOutputICCProfile=${iccPath}`,
    `-sOutputFile=${outputPdf}`,
    inputPdf
  ];
  execFileSync("gs", args, { stdio: "inherit" });
}

function attachXmlWithQpdf(pdfPath: string, xmlPath: string, outputPdf: string): void {
  const baseArgs = [
    "--add-attachment=" + xmlPath,
    "--attachment-name=facturx.xml",
    "--attachment-description=Factur-X XML",
    "--attachment-mimetype=application/xml",
    "--attachment-relationship=Data",
    pdfPath,
    outputPdf
  ];

  try {
    execFileSync("qpdf", baseArgs, { stdio: "inherit" });
  } catch (error) {
    const fallbackArgs = ["--add-attachment=" + xmlPath, pdfPath, outputPdf];
    execFileSync("qpdf", fallbackArgs, { stdio: "inherit" });
  }
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

export async function generateFacturxCli(
  invoice: CanonicalInvoice
): Promise<FacturxArtifacts> {
  ensureTool("gs");
  ensureTool("qpdf");
  const iccProfile = resolveIccProfile();

  const tmpBase = join(tmpdir(), "facturx");
  mkdirSync(tmpBase, { recursive: true });
  const dir = join(tmpBase, `${invoice.tenantId}-${invoice.invoiceNumber}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });

  const xmlContent = buildCiiXml(invoice);
  const xmlBuffer = Buffer.from(xmlContent, "utf8");
  const xmlPath = join(dir, "facturx.xml");
  writeFileSync(xmlPath, xmlBuffer);

  const draftPdfPath = join(dir, "draft.pdf");
  const pdfaPath = join(dir, "pdfa.pdf");
  const finalPdfPath = join(dir, "facturx.pdf");

  const pdfBuffer = buildMinimalPdf(`Invoice ${invoice.invoiceNumber}`);
  writeFileSync(draftPdfPath, pdfBuffer);

  runGhostscriptPdfA(draftPdfPath, pdfaPath, iccProfile);
  attachXmlWithQpdf(pdfaPath, xmlPath, finalPdfPath);

  const finalPdfBuffer = readFileSync(finalPdfPath);

  return {
    pdfPath: finalPdfPath,
    xmlPath,
    pdfSha256: sha256(finalPdfBuffer),
    xmlSha256: sha256(xmlBuffer)
  };
}
