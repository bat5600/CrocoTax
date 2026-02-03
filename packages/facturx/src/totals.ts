import { CanonicalInvoice } from "@croco/core";

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export interface InvoiceTotals {
  netTotal: number;
  taxTotal: number;
  discountTotal: number;
  taxBasisTotal: number;
  grandTotal: number;
  dueTotal: number;
}

export function computeInvoiceTotals(invoice: CanonicalInvoice): InvoiceTotals {
  const netTotal = round2(
    invoice.lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
  );
  const taxTotal = round2(
    invoice.lines.reduce(
      (sum, line) => sum + line.unitPrice * line.quantity * line.taxRate,
      0
    )
  );
  const discountTotal = round2(Math.max(0, invoice.discountTotal ?? 0));
  const taxBasisTotal = round2(Math.max(0, netTotal - discountTotal));
  const grandTotal = round2(netTotal + taxTotal - discountTotal);
  const dueTotal = round2(invoice.totalAmount);

  return {
    netTotal,
    taxTotal,
    discountTotal,
    taxBasisTotal,
    grandTotal,
    dueTotal
  };
}
