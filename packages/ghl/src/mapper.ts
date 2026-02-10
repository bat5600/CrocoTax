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

function asOptionalString(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  if (typeof value === "number") {
    return value.toString();
  }
  return undefined;
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

function normalizeDate(value: unknown): string {
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString().slice(0, 10);
    }
  }
  return new Date().toISOString().slice(0, 10);
}

function normalizeOptionalDate(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const parsed = Date.parse(trimmed);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString().slice(0, 10);
    }
  }
  if (typeof value === "number" && !Number.isNaN(value)) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().slice(0, 10);
    }
  }
  return undefined;
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

function normalizeCurrency(value: unknown): string {
  const raw = asString(value, "EUR").toUpperCase();
  if (/^[A-Z]{3}$/.test(raw)) {
    return raw;
  }
  return "EUR";
}

function buildParty(
  record: Record<string, unknown> | undefined,
  fallbackName: string,
  fallbackCountry: string
): CanonicalInvoice["buyer"] {
  const party: CanonicalInvoice["buyer"] = {
    name: asString(pick(record?.name, record?.fullName, record?.company), fallbackName),
    country: normalizeCountry(pick(record?.country, record?.countryCode, fallbackCountry))
  };
  const addressLine1 = asOptionalString(
    pick(record?.address, record?.address1, record?.street, record?.line1)
  );
  if (addressLine1) party.addressLine1 = addressLine1;
  const addressLine2 = asOptionalString(pick(record?.address2, record?.line2));
  if (addressLine2) party.addressLine2 = addressLine2;
  const postalCode = asOptionalString(pick(record?.postalCode, record?.zip));
  if (postalCode) party.postalCode = postalCode;
  const city = asOptionalString(pick(record?.city, record?.town));
  if (city) party.city = city;
  const state = asOptionalString(pick(record?.state, record?.region));
  if (state) party.state = state;
  const vatId = asOptionalString(pick(record?.vatId, record?.vatNumber));
  if (vatId) party.vatId = vatId;
  const taxId = asOptionalString(pick(record?.taxId));
  if (taxId) party.taxId = taxId;
  const email = asOptionalString(pick(record?.email));
  if (email) party.email = email;
  const phone = asOptionalString(pick(record?.phone, record?.phoneNumber));
  if (phone) party.phone = phone;
  return party;
}

function extractLines(input: Record<string, unknown>): CanonicalInvoice["lines"] {
  const rawLines =
    (Array.isArray(input.lines) && input.lines) ||
    (Array.isArray(input.items) && input.items) ||
    (Array.isArray(input.products) && input.products) ||
    [];

  const mapped = rawLines.map((line) => {
    const row = line as Record<string, unknown>;
    const quantity = asNumber(pick(row.quantity, row.qty), 1);
    const unitPrice = asNumber(pick(row.unitPrice, row.price, row.amount), 0);
    const taxRate = asNumber(pick(row.taxRate, row.vatRate, row.tax), 0);
    return {
      description: asString(
        pick(row.description, row.name, row.title, row.label),
        "Item"
      ),
      quantity: quantity > 0 ? quantity : 1,
      unitPrice: unitPrice >= 0 ? unitPrice : 0,
      taxRate: taxRate >= 0 && taxRate <= 1 ? taxRate : 0
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

function sumLines(lines: CanonicalInvoice["lines"]): number {
  return lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity * (1 + line.taxRate),
    0
  );
}

export function mapGhlToCanonical(tenantId: string, input: GhlInvoice): CanonicalInvoice {
  const record = input as Record<string, unknown>;

  const invoiceNumber = asString(
    pick(record.invoiceNumber, record.number, record.invoice_id, record.id),
    "INV-UNKNOWN"
  );
  const issueDate = normalizeDate(pick(record.issueDate, record.date, record.updatedAt));
  const currency = normalizeCurrency(pick(record.currency, record.currencyCode));

  const buyer = record.customer as Record<string, unknown> | undefined;
  const seller = record.seller as Record<string, unknown> | undefined;
  const dueDate = normalizeOptionalDate(pick(record.dueDate, record.due_date));
  const paymentTerms = asOptionalString(pick(record.paymentTerms, record.terms));
  const notes = asOptionalString(pick(record.notes, record.memo));

  const lines = extractLines(record);
  const lineTotal = sumLines(lines);
  const discountTotal = asNumber(
    pick(record.discountTotal, record.discountAmount, record.discount),
    0
  );
  const discountedLineTotal = Math.max(0, lineTotal - Math.max(0, discountTotal));
  const reportedTotal = pick(record.totalAmount, record.amount, record.total);
  const parsedTotal = asNumber(reportedTotal, discountedLineTotal);
  const tolerance = 0.01;
  const diff = Math.abs(parsedTotal - discountedLineTotal);
  const totalAmount = diff > tolerance + 1e-9 ? discountedLineTotal : parsedTotal;

  const canonical: CanonicalInvoice = {
    tenantId,
    invoiceNumber,
    issueDate,
    currency,
    totalAmount,
    discountTotal: discountTotal > 0 ? discountTotal : undefined,
    buyer: {
      ...buildParty(buyer, "Buyer", "FR")
    },
    seller: {
      ...buildParty(seller, "Seller", "FR"),
      name: asString(pick(seller?.name, seller?.company, record.company), "Seller")
    },
    lines
  };
  if (dueDate) {
    canonical.dueDate = dueDate;
  }
  if (paymentTerms) {
    canonical.paymentTerms = paymentTerms;
  }
  if (notes) {
    canonical.notes = notes;
  }

  const parsed = CanonicalInvoiceSchema.safeParse(canonical);
  if (!parsed.success) {
    const message = parsed.error.issues.map((issue) => issue.message).join("; ");
    throw new Error(`Canonical invoice validation failed: ${message}`);
  }

  return parsed.data;
}
