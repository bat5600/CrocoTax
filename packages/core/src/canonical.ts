import { z } from "zod";

export const CanonicalLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().min(0).max(1)
});

export const CanonicalPartySchema = z.object({
  name: z.string().min(1),
  country: z.string().regex(/^[A-Z]{2}$/),
  addressLine1: z.string().min(1).optional(),
  addressLine2: z.string().min(1).optional(),
  postalCode: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  vatId: z.string().min(1).optional(),
  taxId: z.string().min(1).optional(),
  email: z.string().min(1).optional(),
  phone: z.string().min(1).optional()
});

export const CanonicalInvoiceSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().min(1),
  invoiceNumber: z.string().min(1),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  totalAmount: z.number().nonnegative(),
  discountTotal: z.number().nonnegative().optional(),
  paymentTerms: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
  buyer: CanonicalPartySchema,
  seller: CanonicalPartySchema,
  lines: z.array(CanonicalLineSchema).min(1)
}).superRefine((invoice, ctx) => {
  const lineTotal = invoice.lines.reduce(
    (sum, line) => sum + line.unitPrice * line.quantity * (1 + line.taxRate),
    0
  );
  const discountTotal = Math.max(0, invoice.discountTotal ?? 0);
  const expectedTotal = Math.max(0, lineTotal - discountTotal);
  const tolerance = 0.01;
  if (Math.abs(invoice.totalAmount - expectedTotal) > tolerance + 1e-9) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "totalAmount does not match line totals",
      path: ["totalAmount"]
    });
  }
});

export type CanonicalInvoice = z.infer<typeof CanonicalInvoiceSchema>;
