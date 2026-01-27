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
      totalAmount: 250.5,
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
});
