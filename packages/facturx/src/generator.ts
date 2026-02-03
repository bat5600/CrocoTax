import { execFileSync } from "child_process";
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { delimiter, join } from "path";
import { CanonicalInvoice } from "@croco/core";
import { buildCiiXml } from "./cii";
import { renderInvoicePdf } from "./render/pdf";

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
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

function resolvePdfBoxJar(): string | undefined {
  const candidates = [
    process.env.PDFBOX_JAR,
    join(process.cwd(), "tools", "pdfbox-app-3.0.2.jar")
  ];
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }
  return undefined;
}

function attachXmlWithPdfBox(
  inputPdf: string,
  xmlPath: string,
  outputPdf: string,
  iccPath: string,
  pdfBoxJar: string
): void {
  ensureTool("java");
  ensureTool("javac");
  const javaSource = join(process.cwd(), "scripts", "FacturxAttach.java");
  const buildDir = join(tmpdir(), "facturx-pdfbox");
  mkdirSync(buildDir, { recursive: true });
  execFileSync("javac", ["-cp", pdfBoxJar, "-d", buildDir, javaSource], {
    stdio: "inherit"
  });
  const classPath = `${buildDir}${delimiter}${pdfBoxJar}`;
  execFileSync(
    "java",
    [
      "-Djava.awt.headless=true",
      "-cp",
      classPath,
      "FacturxAttach",
      inputPdf,
      xmlPath,
      outputPdf,
      iccPath
    ],
    { stdio: "inherit" }
  );
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
  const pdfaDefPath = join(tmpdir(), `facturx-pdfa-def-${Date.now()}.ps`);
  const pdfaDef = `%!\n/ICCProfile (${iccPath}) def\n/OutputIntent <<\n  /Type /OutputIntent\n  /S /GTS_PDFA3\n  /OutputConditionIdentifier (sRGB IEC61966-2.1)\n  /Info (sRGB IEC61966-2.1)\n  /RegistryName (http://www.color.org)\n  /DestOutputProfile ICCProfile\n>> def\n<< /OutputIntents [ OutputIntent ] >> setdistillerparams\n`;
  writeFileSync(pdfaDefPath, pdfaDef);
  const args = [
    "-dPDFA=3",
    "-dBATCH",
    "-dNOPAUSE",
    "-dNOOUTERSAVE",
    "-sDEVICE=pdfwrite",
    "-sColorConversionStrategy=RGB",
    "-sProcessColorModel=DeviceRGB",
    "-dPDFACompatibilityPolicy=1",
    `-sOutputICCProfile=${iccPath}`,
    `-sOutputFile=${outputPdf}`,
    pdfaDefPath,
    inputPdf
  ];
  execFileSync("gs", args, { stdio: "inherit" });
}

function attachXmlWithQpdf(pdfPath: string, xmlPath: string, outputPdf: string): void {
  const baseArgs = [
    "--add-attachment",
    xmlPath,
    "--description=Factur-X XML",
    "--filename=facturx.xml",
    "--key=facturx.xml",
    "--mimetype=application/xml",
    "--",
    pdfPath,
    outputPdf
  ];

  try {
    execFileSync("qpdf", baseArgs, { stdio: "inherit" });
  } catch (error) {
    const fallbackArgs = ["--add-attachment", xmlPath, "--", pdfPath, outputPdf];
    execFileSync("qpdf", fallbackArgs, { stdio: "inherit" });
  }
}

function addAssociatedFileRelationship(pdfPath: string, outputPdf: string): void {
  const patchedPath = pdfPath.replace(/\.pdf$/i, ".patched.pdf");
  const pdf = readFileSync(pdfPath, "latin1");
  let fileSpecId: string | undefined;

  let updatedPdf = pdf;
  const objRegex = /(\d+)\s+0\s+obj/g;
  let match: RegExpExecArray | null;
  while ((match = objRegex.exec(pdf)) !== null) {
    const objId = match[1];
    const start = match.index;
    const end = pdf.indexOf("endobj", objRegex.lastIndex);
    if (end === -1) {
      break;
    }
    const objText = pdf.slice(start, end + "endobj".length);
    if (/\/Type\s*\/Filespec/.test(objText)) {
      fileSpecId = objId;
      if (!/\/AFRelationship\s*\//.test(objText)) {
        const updated = objText.replace(
          />>\s*endobj/,
          `\n/AFRelationship /Data\n>>\nendobj`
        );
        updatedPdf = updatedPdf.replace(objText, updated);
      }
      break;
    }
    objRegex.lastIndex = end + "endobj".length;
  }

  if (!fileSpecId) {
    throw new Error("Unable to locate Filespec object for embedded XML.");
  }

  objRegex.lastIndex = 0;
  while ((match = objRegex.exec(updatedPdf)) !== null) {
    const start = match.index;
    const end = updatedPdf.indexOf("endobj", objRegex.lastIndex);
    if (end === -1) {
      break;
    }
    const objText = updatedPdf.slice(start, end + "endobj".length);
    if (/\/Type\s*\/Catalog/.test(objText)) {
      if (!/\/AF\s*\[/.test(objText)) {
        const updated = objText.replace(
          />>\s*endobj/,
          `\n/AF [${fileSpecId} 0 R]\n>>\nendobj`
        );
        updatedPdf = updatedPdf.replace(objText, updated);
      }
      break;
    }
    objRegex.lastIndex = end + "endobj".length;
  }

  writeFileSync(patchedPath, updatedPdf, "latin1");
  execFileSync("qpdf", ["--warning-exit-0", patchedPath, outputPdf], {
    stdio: "inherit"
  });
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
  const pdfBuffer = await renderInvoicePdf(invoice);

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
  const pdfBoxJar = resolvePdfBoxJar();

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

  const pdfBuffer = await renderInvoicePdf(invoice);
  writeFileSync(draftPdfPath, pdfBuffer);

  runGhostscriptPdfA(draftPdfPath, pdfaPath, iccProfile);
  if (pdfBoxJar) {
    attachXmlWithPdfBox(pdfaPath, xmlPath, finalPdfPath, iccProfile, pdfBoxJar);
  } else {
    attachXmlWithQpdf(pdfaPath, xmlPath, finalPdfPath);
    addAssociatedFileRelationship(finalPdfPath, finalPdfPath);
  }

  const finalPdfBuffer = readFileSync(finalPdfPath);

  return {
    pdfPath: finalPdfPath,
    xmlPath,
    pdfSha256: sha256(finalPdfBuffer),
    xmlSha256: sha256(xmlBuffer)
  };
}
