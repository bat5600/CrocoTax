import { describe, expect, it } from "vitest";
import { CanonicalInvoiceSchema } from "@croco/core";

describe("CanonicalInvoiceSchema", () => {
  it("accepts totals that match line sums", () => {
    const result = CanonicalInvoiceSchema.safeParse({
      tenantId: "tenant_ok",
      invoiceNumber: "INV-OK-1",
      issueDate: "2026-01-27",
      currency: "EUR",
      totalAmount: 120,
      buyer: { name: "Buyer", country: "FR" },
      seller: { name: "Seller", country: "FR" },
      lines: [
        {
          description: "Line",
          quantity: 1,
          unitPrice: 100,
          taxRate: 0.2
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("accepts totals that match line sums minus discounts", () => {
    const result = CanonicalInvoiceSchema.safeParse({
      tenantId: "tenant_disc",
      invoiceNumber: "INV-DISC-1",
      issueDate: "2026-01-27",
      currency: "EUR",
      totalAmount: 90,
      discountTotal: 10,
      buyer: { name: "Buyer", country: "FR" },
      seller: { name: "Seller", country: "FR" },
      lines: [
        {
          description: "Line",
          quantity: 1,
          unitPrice: 100,
          taxRate: 0
        }
      ]
    });

    expect(result.success).toBe(true);
  });

  it("rejects totals that do not match line sums", () => {
    const result = CanonicalInvoiceSchema.safeParse({
      tenantId: "tenant_bad",
      invoiceNumber: "INV-BAD-1",
      issueDate: "2026-01-27",
      currency: "EUR",
      totalAmount: 130,
      buyer: { name: "Buyer", country: "FR" },
      seller: { name: "Seller", country: "FR" },
      lines: [
        {
          description: "Line",
          quantity: 1,
          unitPrice: 100,
          taxRate: 0.2
        }
      ]
    });

    expect(result.success).toBe(false);
  });
});
