import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { mapGhlToCanonical } from "@croco/ghl";

function loadFixture<T>(name: string): T {
  const raw = readFileSync(join(process.cwd(), "fixtures", name), "utf8");
  return JSON.parse(raw) as T;
}

describe("GHL mapper", () => {
  it("maps the base fixture to the canonical shape", () => {
    const ghl = loadFixture<Record<string, unknown>>("ghl-invoice.json");
    const expected = loadFixture<Record<string, unknown>>("canonical-invoice.json");

    const canonical = mapGhlToCanonical("tenant_demo", ghl as never);

    expect(canonical).toEqual(expected);
  });

  it("supports alternate field names and normalizes currency/country", () => {
    const ghl = loadFixture<Record<string, unknown>>("ghl-invoice-alt-fields.json");

    const canonical = mapGhlToCanonical("tenant_alt", ghl as never);

    expect(canonical).toEqual({
      tenantId: "tenant_alt",
      invoiceNumber: "ALT-2026-0042",
      issueDate: "2026-01-20",
      currency: "USD",
      totalAmount: 270.5,
      buyer: {
        name: "Alt Buyer",
        country: "US"
      },
      seller: {
        name: "Alt Seller Inc",
        country: "FR"
      },
      lines: [
        {
          description: "Service A",
          quantity: 2,
          unitPrice: 100,
          taxRate: 0.1
        },
        {
          description: "Service B",
          quantity: 1,
          unitPrice: 50.5,
          taxRate: 0
        }
      ]
    });
  });

  it("clamps negative line values to schema-safe defaults", () => {
    const ghl = loadFixture<Record<string, unknown>>("ghl-invoice-negative.json");

    const canonical = mapGhlToCanonical("tenant_neg", ghl as never);

    expect(canonical.lines).toEqual([
      {
        description: "Bad line",
        quantity: 1,
        unitPrice: 0,
        taxRate: 0
      }
    ]);
  });

  it("creates a default line when no lines are present", () => {
    const ghl = loadFixture<Record<string, unknown>>("ghl-invoice-minimal.json");

    const canonical = mapGhlToCanonical("tenant_min", ghl as never);

    expect(canonical).toEqual({
      tenantId: "tenant_min",
      invoiceNumber: "INV-UNKNOWN",
      issueDate: "2026-01-22",
      currency: "EUR",
      totalAmount: 42.5,
      buyer: {
        name: "Buyer",
        country: "FR"
      },
      seller: {
        name: "Seller",
        country: "FR"
      },
      lines: [
        {
          description: "Item",
          quantity: 1,
          unitPrice: 42.5,
          taxRate: 0
        }
      ]
    });
  });

  it("falls back to line totals when reported total mismatches", () => {
    const ghl = loadFixture<Record<string, unknown>>("ghl-invoice-total-mismatch.json");

    const canonical = mapGhlToCanonical("tenant_mismatch", ghl as never);

    expect(canonical.totalAmount).toBe(100.5);
  });

  it("keeps reported totals when within tolerance", () => {
    const ghl = loadFixture<Record<string, unknown>>("ghl-invoice-total-tolerance.json");

    const canonical = mapGhlToCanonical("tenant_tolerance", ghl as never);

    expect(canonical.totalAmount).toBe(120.01);
  });

  it("normalizes invalid country and currency values", () => {
    const ghl = loadFixture<Record<string, unknown>>("ghl-invoice-invalid-country.json");

    const canonical = mapGhlToCanonical("tenant_bad_country", ghl as never);

    expect(canonical.buyer.country).toBe("FR");
    expect(canonical.seller.country).toBe("FR");
  });

  it("normalizes invalid currency codes", () => {
    const ghl = loadFixture<Record<string, unknown>>("ghl-invoice-invalid-currency.json");

    const canonical = mapGhlToCanonical("tenant_bad_currency", ghl as never);

    expect(canonical.currency).toBe("EUR");
  });

  it("falls back to placeholder parties when missing", () => {
    const ghl = loadFixture<Record<string, unknown>>("ghl-invoice-missing-parties.json");

    const canonical = mapGhlToCanonical("tenant_missing_parties", ghl as never);

    expect(canonical.buyer.name).toBe("Buyer");
    expect(canonical.seller.name).toBe("Seller");
  });

  it("clamps out-of-range tax rates to zero", () => {
    const ghl = loadFixture<Record<string, unknown>>("ghl-invoice-invalid-taxrate.json");

    const canonical = mapGhlToCanonical("tenant_bad_tax", ghl as never);

    expect(canonical.lines[0]?.taxRate).toBe(0);
  });

  it("reconciles totals with mixed tax rates", () => {
    const ghl = loadFixture<Record<string, unknown>>("ghl-invoice-mixed-tax.json");

    const canonical = mapGhlToCanonical("tenant_mixed_tax", ghl as never);

    expect(canonical.totalAmount).toBe(225.5);
  });

  it("applies discount totals when present", () => {
    const ghl = loadFixture<Record<string, unknown>>("ghl-invoice-discount.json");

    const canonical = mapGhlToCanonical("tenant_discount", ghl as never);

    expect(canonical.totalAmount).toBe(90);
  });

  it("sanitizes credit note negatives into zero totals", () => {
    const ghl = loadFixture<Record<string, unknown>>("ghl-invoice-credit-note.json");

    const canonical = mapGhlToCanonical("tenant_credit", ghl as never);

    expect(canonical.totalAmount).toBe(0);
  });
});
