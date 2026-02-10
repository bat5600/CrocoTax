import PDFDocument from "pdfkit";
import { CanonicalInvoice, CanonicalParty } from "@croco/core";
import { computeInvoiceTotals } from "../totals";

const PAGE_MARGIN = 40;

function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return value;
  }
  return `${match[3]}/${match[2]}/${match[1]}`;
}

function formatMoney(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

function partyDetailLines(party: CanonicalParty): string[] {
  const lines: string[] = [];
  if (party.addressLine1) lines.push(party.addressLine1);
  if (party.addressLine2) lines.push(party.addressLine2);
  const cityLine = [party.postalCode, party.city].filter(Boolean).join(" ");
  if (cityLine) lines.push(cityLine);
  if (party.state) lines.push(party.state);
  if (party.country) lines.push(party.country);
  const taxId = party.vatId ?? party.taxId;
  if (taxId) lines.push(`TVA: ${taxId}`);
  if (party.email) lines.push(party.email);
  if (party.phone) lines.push(party.phone);
  return lines;
}

function drawLines(
  doc: PDFKit.PDFDocument,
  lines: string[],
  x: number,
  y: number,
  width: number,
  align: PDFKit.Mixins.TextOptions["align"] = "left",
  lineGap = 2
): number {
  let cursor = y;
  for (const line of lines) {
    if (!line) continue;
    doc.text(line, x, cursor, { width, align });
    cursor = doc.y + lineGap;
  }
  return cursor;
}

function drawTableHeader(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  columns: Array<{ label: string; width: number; align: PDFKit.Mixins.TextOptions["align"] }>,
  tableWidth: number
): number {
  doc.font("Helvetica-Bold").fontSize(10);
  let cursorX = x;
  for (const column of columns) {
    doc.text(column.label, cursorX, y, { width: column.width, align: column.align });
    cursorX += column.width;
  }
  const headerHeight = doc.currentLineHeight() + 4;
  doc
    .moveTo(x, y + headerHeight)
    .lineTo(x + tableWidth, y + headerHeight)
    .stroke();
  return y + headerHeight + 4;
}

function ensureSpace(doc: PDFKit.PDFDocument, y: number, height: number): number {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (y + height <= bottom) {
    return y;
  }
  doc.addPage();
  return doc.page.margins.top;
}

export async function renderInvoicePdf(invoice: CanonicalInvoice): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: PAGE_MARGIN });
  const chunks: Buffer[] = [];

  const result = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.font("Helvetica").fontSize(10);
  doc.lineWidth(0.5);

  const { left, right, top } = doc.page.margins;
  const pageWidth = doc.page.width - left - right;
  const leftWidth = pageWidth * 0.55;
  const rightWidth = pageWidth - leftWidth;
  const rightX = left + leftWidth;

  let y = top;

  doc.font("Helvetica-Bold").fontSize(12);
  doc.text(invoice.seller.name, left, y, { width: leftWidth });
  let leftEnd = doc.y + 2;

  doc.font("Helvetica").fontSize(10);
  leftEnd = drawLines(doc, partyDetailLines(invoice.seller), left, leftEnd, leftWidth);

  let rightEnd = y;
  doc.font("Helvetica-Bold").fontSize(18);
  doc.text("FACTURE", rightX, rightEnd, { width: rightWidth, align: "right" });
  rightEnd = doc.y + 4;

  doc.font("Helvetica").fontSize(10);
  const rightLines = [
    `No: ${invoice.invoiceNumber}`,
    `Date emission: ${formatDate(invoice.issueDate)}`,
    invoice.dueDate ? `Echeance: ${formatDate(invoice.dueDate)}` : null,
    `Devise: ${invoice.currency}`
  ].filter(Boolean) as string[];
  rightEnd = drawLines(doc, rightLines, rightX, rightEnd, rightWidth, "right");

  y = Math.max(leftEnd, rightEnd) + 16;

  doc.font("Helvetica-Bold").fontSize(11);
  doc.text("Client", left, y, { width: leftWidth });
  y = doc.y + 4;

  doc.font("Helvetica").fontSize(10);
  y = drawLines(doc, [invoice.buyer.name, ...partyDetailLines(invoice.buyer)], left, y, leftWidth);
  y += 12;

  const columns = [
    { label: "Description", width: pageWidth * 0.45, align: "left" as const },
    { label: "Qte", width: pageWidth * 0.1, align: "right" as const },
    { label: "PU HT", width: pageWidth * 0.15, align: "right" as const },
    { label: "TVA %", width: pageWidth * 0.1, align: "right" as const },
    { label: "Total TTC", width: pageWidth * 0.2, align: "right" as const }
  ];

  y = drawTableHeader(doc, left, y, columns, pageWidth);
  doc.font("Helvetica").fontSize(10);

  const bottom = doc.page.height - doc.page.margins.bottom;

  for (const line of invoice.lines) {
    const lineNet = line.quantity * line.unitPrice;
    const lineTax = lineNet * line.taxRate;
    const lineTotal = lineNet + lineTax;
    const descHeight = doc.heightOfString(line.description, { width: columns[0].width });
    const rowHeight = Math.max(descHeight, doc.currentLineHeight()) + 4;

    if (y + rowHeight > bottom) {
      doc.addPage();
      y = drawTableHeader(doc, left, doc.page.margins.top, columns, pageWidth);
      doc.font("Helvetica").fontSize(10);
    }

    let cursorX = left;
    doc.text(line.description, cursorX, y, { width: columns[0].width, align: "left" });
    cursorX += columns[0].width;
    doc.text(line.quantity.toFixed(2), cursorX, y, { width: columns[1].width, align: "right" });
    cursorX += columns[1].width;
    doc.text(formatMoney(line.unitPrice, invoice.currency), cursorX, y, {
      width: columns[2].width,
      align: "right"
    });
    cursorX += columns[2].width;
    doc.text((line.taxRate * 100).toFixed(2), cursorX, y, {
      width: columns[3].width,
      align: "right"
    });
    cursorX += columns[3].width;
    doc.text(formatMoney(lineTotal, invoice.currency), cursorX, y, {
      width: columns[4].width,
      align: "right"
    });

    y += rowHeight;
  }

  y += 6;
  doc
    .moveTo(left, y)
    .lineTo(left + pageWidth, y)
    .stroke();
  y += 10;

  const totals = computeInvoiceTotals(invoice);
  const totalsX = left + pageWidth * 0.55;
  const totalsWidth = pageWidth * 0.45;
  const labelWidth = totalsWidth * 0.6;
  const valueWidth = totalsWidth - labelWidth;

  const drawTotalRow = (label: string, value: string, bold = false, size = 10) => {
    y = ensureSpace(doc, y, doc.currentLineHeight() + 6);
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(size);
    doc.text(label, totalsX, y, { width: labelWidth, align: "left" });
    doc.text(value, totalsX + labelWidth, y, { width: valueWidth, align: "right" });
    y = doc.y + 4;
  };

  drawTotalRow("Sous-total HT", formatMoney(totals.netTotal, invoice.currency));
  drawTotalRow("TVA", formatMoney(totals.taxTotal, invoice.currency));
  if (totals.discountTotal > 0) {
    drawTotalRow("Remise", `-${formatMoney(totals.discountTotal, invoice.currency)}`);
  }
  drawTotalRow("Total TTC", formatMoney(totals.dueTotal, invoice.currency), true, 12);

  const notes: string[] = [];
  if (invoice.paymentTerms) {
    notes.push(`Conditions: ${invoice.paymentTerms}`);
  }
  if (invoice.notes) {
    notes.push(`Notes: ${invoice.notes}`);
  }
  if (notes.length > 0) {
    y += 8;
    y = ensureSpace(doc, y, doc.currentLineHeight() * notes.length + 12);
    doc.font("Helvetica").fontSize(9);
    doc.text(notes.join("\n"), left, y, { width: pageWidth });
  }

  doc.end();
  return result;
}
