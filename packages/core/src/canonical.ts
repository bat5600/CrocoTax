import { z } from "zod";

export const CanonicalLineSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative(),
  taxRate: z.number().min(0)
});

export const CanonicalPartySchema = z.object({
  name: z.string().min(1),
  country: z.string().min(2).max(2)
});

export const CanonicalInvoiceSchema = z.object({
  id: z.string().optional(),
  tenantId: z.string().min(1),
  invoiceNumber: z.string().min(1),
  issueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.string().min(3).max(3),
  totalAmount: z.number().nonnegative(),
  buyer: CanonicalPartySchema,
  seller: CanonicalPartySchema,
  lines: z.array(CanonicalLineSchema).min(1)
});

export type CanonicalInvoice = z.infer<typeof CanonicalInvoiceSchema>;
