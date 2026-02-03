import { describe, expect, it } from "vitest";
import { buildCiiXml } from "@croco/facturx";
import { CanonicalInvoice } from "@croco/core";

describe("buildCiiXml", () => {
  it("includes optional party fields and totals", () => {
    const invoice: CanonicalInvoice = {
      tenantId: "tenant_demo",
      invoiceNumber: "INV-2026-0002",
      issueDate: "2026-01-25",
      dueDate: "2026-02-10",
      currency: "EUR",
      totalAmount: 120,
      paymentTerms: "Paiement a 30 jours",
      buyer: {
        name: "Acme Buyer",
        country: "FR",
        addressLine1: "1 Rue de Paris",
        postalCode: "75001",
        city: "Paris",
        vatId: "FR123456789"
      },
      seller: {
        name: "CrocoClick Demo",
        country: "FR",
        addressLine1: "2 Avenue de Lyon",
        postalCode: "69001",
        city: "Lyon",
        email: "seller@example.com"
      },
      lines: [
        {
          description: "Subscription",
          quantity: 1,
          unitPrice: 100,
          taxRate: 0.2
        }
      ]
    };

    const xml = buildCiiXml(invoice);
    expect(xml).toContain("<ram:LineOne>1 Rue de Paris</ram:LineOne>");
    expect(xml).toContain("<ram:SpecifiedTaxRegistration>");
    expect(xml).toContain("<ram:EmailURIUniversalCommunication>");
    expect(xml).toContain("<ram:TaxTotalAmount>20.00</ram:TaxTotalAmount>");
    expect(xml).toContain("<ram:DueDateDateTime>");
  });
});
