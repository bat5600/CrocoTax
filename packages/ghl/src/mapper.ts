import { CanonicalInvoice, CanonicalInvoiceSchema } from "@croco/core";
import type { GhlInvoice } from "./index";

function asString(value: unknown, fallback = ""): string {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number") {
    return value.toString();
  }
  return fallback;
}

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

function asDate(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    return value;
  }
  return new Date().toISOString().slice(0, 10);
}

function pick<T>(...values: Array<T | undefined | null>): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function normalizeCountry(value: unknown): string {
  const raw = asString(value, "FR").toUpperCase();
  if (raw.length === 2) {
    return raw;
  }
  return "FR";
}

function extractLines(input: Record<string, unknown>): CanonicalInvoice["lines"] {
  const rawLines =
    (Array.isArray(input.lines) && input.lines) ||
    (Array.isArray(input.items) && input.items) ||
    (Array.isArray(input.products) && input.products) ||
    [];

  const mapped = rawLines.map((line) => {
    const row = line as Record<string, unknown>;
    return {
      description: asString(
        pick(row.description, row.name, row.title, row.label),
        "Item"
      ),
      quantity: asNumber(pick(row.quantity, row.qty), 1),
      unitPrice: asNumber(pick(row.unitPrice, row.price, row.amount), 0),
      taxRate: asNumber(pick(row.taxRate, row.vatRate, row.tax), 0)
    };
  });

  return mapped.length > 0
    ? mapped
    : [
        {
          description: "Item",
          quantity: 1,
          unitPrice: asNumber(input.totalAmount, 0),
          taxRate: 0
        }
      ];
}

export function mapGhlToCanonical(tenantId: string, input: GhlInvoice): CanonicalInvoice {
  const record = input as Record<string, unknown>;

  const invoiceNumber = asString(
    pick(record.invoiceNumber, record.number, record.invoice_id, record.id),
    "INV-UNKNOWN"
  );
  const issueDate = asDate(pick(record.issueDate, record.date, record.updatedAt));
  const currency = asString(pick(record.currency, record.currencyCode), "EUR");

  const buyer = record.customer as Record<string, unknown> | undefined;
  const seller = record.seller as Record<string, unknown> | undefined;

  const lines = extractLines(record);
  const totalAmount = asNumber(
    pick(record.totalAmount, record.amount, record.total),
    lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0)
  );

  const canonical: CanonicalInvoice = {
    tenantId,
    invoiceNumber,
    issueDate,
    currency,
    totalAmount,
    buyer: {
      name: asString(pick(buyer?.name, buyer?.fullName, buyer?.company), "Buyer"),
      country: normalizeCountry(pick(buyer?.country, buyer?.countryCode))
    },
    seller: {
      name: asString(pick(seller?.name, seller?.company, record.company), "Seller"),
      country: normalizeCountry(pick(seller?.country, seller?.countryCode))
    },
    lines
  };

  const parsed = CanonicalInvoiceSchema.safeParse(canonical);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new Error(`Canonical invoice validation failed: ${message}`);
  }

  return parsed.data;
}
