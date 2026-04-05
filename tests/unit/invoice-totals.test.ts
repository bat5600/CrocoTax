import { describe, it, expect } from "vitest";
import { computeInvoiceTotals } from "@croco/facturx/src/totals";
import { CanonicalInvoice } from "@croco/core";

function makeInvoice(overrides: Partial<CanonicalInvoice> & { lines: CanonicalInvoice["lines"] }): CanonicalInvoice {
  return {
    tenantId: "tenant_test",
    invoiceNumber: "INV-TEST-001",
    issueDate: "2026-01-01",
    currency: "EUR",
    totalAmount: 0,
    buyer: { name: "Buyer", country: "FR" },
    seller: { name: "Seller", country: "FR" },
    ...overrides
  };
}

describe("computeInvoiceTotals", () => {
  it("computes totals for a simple invoice with one line", () => {
    const invoice = makeInvoice({
      lines: [{ description: "Widget", quantity: 2, unitPrice: 50, taxRate: 0.2 }]
    });

    const totals = computeInvoiceTotals(invoice);

    expect(totals.netTotal).toBe(100);
    expect(totals.taxTotal).toBe(20);
    expect(totals.discountTotal).toBe(0);
    expect(totals.taxBasisTotal).toBe(100);
    expect(totals.grandTotal).toBe(120);
    expect(totals.dueTotal).toBe(120);
  });

  it("computes totals for multiple lines with different tax rates", () => {
    const invoice = makeInvoice({
      lines: [
        { description: "Standard rated item", quantity: 1, unitPrice: 100, taxRate: 0.2 },
        { description: "Reduced rated item", quantity: 3, unitPrice: 10, taxRate: 0.055 }
      ]
    });

    const totals = computeInvoiceTotals(invoice);

    // net: 100 + 30 = 130
    expect(totals.netTotal).toBe(130);
    // tax: 100*0.2 + 30*0.055 = 20 + 1.65 = 21.65
    expect(totals.taxTotal).toBe(21.65);
    expect(totals.discountTotal).toBe(0);
    expect(totals.taxBasisTotal).toBe(130);
    expect(totals.grandTotal).toBe(151.65);
    expect(totals.dueTotal).toBe(151.65);
  });

  it("applies discount correctly", () => {
    const invoice = makeInvoice({
      discountTotal: 10,
      lines: [{ description: "Service", quantity: 1, unitPrice: 100, taxRate: 0.2 }]
    });

    const totals = computeInvoiceTotals(invoice);

    expect(totals.netTotal).toBe(100);
    expect(totals.taxTotal).toBe(20);
    expect(totals.discountTotal).toBe(10);
    expect(totals.grandTotal).toBe(110); // 100 + 20 - 10
    expect(totals.dueTotal).toBe(110);
  });

  it("handles zero tax rate (export)", () => {
    const invoice = makeInvoice({
      lines: [{ description: "Export goods", quantity: 5, unitPrice: 200, taxRate: 0 }]
    });

    const totals = computeInvoiceTotals(invoice);

    expect(totals.netTotal).toBe(1000);
    expect(totals.taxTotal).toBe(0);
    expect(totals.discountTotal).toBe(0);
    expect(totals.grandTotal).toBe(1000);
    expect(totals.dueTotal).toBe(1000);
  });

  it("treats negative discountTotal as zero", () => {
    const invoice = makeInvoice({
      discountTotal: -5,
      lines: [{ description: "Item", quantity: 1, unitPrice: 50, taxRate: 0.1 }]
    });

    const totals = computeInvoiceTotals(invoice);

    expect(totals.discountTotal).toBe(0);
    expect(totals.grandTotal).toBe(55); // 50 + 5 - 0
  });

  it("treats missing discountTotal as zero", () => {
    const invoice = makeInvoice({
      lines: [{ description: "Item", quantity: 1, unitPrice: 80, taxRate: 0.2 }]
    });
    // Ensure discountTotal is undefined
    delete (invoice as Record<string, unknown>).discountTotal;

    const totals = computeInvoiceTotals(invoice);

    expect(totals.discountTotal).toBe(0);
    expect(totals.grandTotal).toBe(96); // 80 + 16
  });
});
