import { describe, expect, it } from "vitest";
import { renderInvoicePdf } from "@croco/facturx";
import { CanonicalInvoice } from "@croco/core";

describe("renderInvoicePdf", () => {
  it("renders a non-empty PDF buffer", async () => {
    const invoice: CanonicalInvoice = {
      tenantId: "tenant_demo",
      invoiceNumber: "INV-2026-0001",
      issueDate: "2026-01-25",
      currency: "EUR",
      totalAmount: 120,
      buyer: { name: "Buyer", country: "FR" },
      seller: { name: "Seller", country: "FR" },
      lines: [
        {
          description: "Subscription",
          quantity: 1,
          unitPrice: 100,
          taxRate: 0.2
        }
      ]
    };

    const buffer = await renderInvoicePdf(invoice);
    expect(buffer.slice(0, 5).toString("utf8")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(500);
  });
});
