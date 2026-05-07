import type {
  ClientInvoiceFormInput,
  InvoiceLineItem,
  InvoiceStatus,
} from "@/types/invoice";
import {
  calculateInvoiceLineTotal,
  calculateInvoiceSubtotal,
  calculateInvoiceTotal,
  roundCurrency,
} from "@/lib/invoices/money";
import { z } from "zod";

export interface InvoiceFormErrors {
  dueDate?: string;
  currency?: string;
  taxAmount?: string;
  lineItems?: string;
  form?: string;
}

export type InvoiceFormValidationResult =
  | {
      ok: true;
      data: ClientInvoiceFormInput & {
        subtotal: number;
        totalAmount: number;
      };
      errors?: never;
    }
  | { ok: false; data?: never; errors: InvoiceFormErrors };

const nonEmptyStringSchema = z.string().trim().min(1);
const nullableTrimmedStringSchema = z.string().trim().min(1).nullable().optional();
const entityIdSchema = z.string().trim().min(1);
const isoDateStringSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)), {
    message: "Must be a valid date.",
  });
const moneySchema = z
  .number()
  .finite()
  .nonnegative()
  .transform((value) => roundMoney(value));
const positiveQuantitySchema = z
  .number()
  .finite()
  .positive()
  .transform((value) => roundMoney(value));

export const invoiceStatusTransitions = {
  draft: ["sent", "void", "cancelled"],
  issued: ["viewed", "overdue", "paid", "void", "disputed", "cancelled"],
  sent: ["viewed", "overdue", "paid", "void", "disputed", "cancelled"],
  viewed: ["overdue", "paid", "void", "disputed"],
  overdue: ["paid", "disputed"],
  disputed: ["resolved", "void", "sent"],
  resolved: ["sent", "paid", "void", "disputed"],
  paid: [],
  void: [],
  cancelled: [],
} as const satisfies Record<InvoiceStatus, readonly InvoiceStatus[]>;

export const invoiceLineItemSchema = z
  .object({
    id: entityIdSchema.optional(),
    description: nonEmptyStringSchema,
    quantity: positiveQuantitySchema,
    unitPrice: moneySchema,
    lineTotal: moneySchema.optional(),
  })
  .transform((value) => ({
    ...value,
    id: value.id ?? crypto.randomUUID(),
    lineTotal: roundMoney(
      value.lineTotal ?? calculateInvoiceLineTotal(value.quantity, value.unitPrice),
    ),
  }))
  .superRefine((value, context) => {
    const calculated = roundMoney(value.quantity * value.unitPrice);
    if (calculated !== value.lineTotal) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "lineTotal must equal quantity multiplied by unitPrice.",
        path: ["lineTotal"],
      });
    }
  });

const invoiceMoneyFieldsSchema = z.object({
  subtotal: moneySchema.optional(),
  taxAmount: moneySchema,
  totalAmount: moneySchema.optional(),
});

const invoiceDraftPayloadSchema = z
  .object({
    workOrderId: entityIdSchema,
    invoiceId: entityIdSchema.optional(),
    dueDate: isoDateStringSchema,
    currency: z.enum(["CAD", "USD"]),
    lineItems: z.array(invoiceLineItemSchema),
    subtotal: moneySchema.optional(),
    taxAmount: moneySchema,
    totalAmount: moneySchema.optional(),
    notes: nullableTrimmedStringSchema,
  })
  .superRefine((value, context) => {
    if (value.lineItems.length < 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one line item is required.",
        path: ["lineItems"],
      });
    }

    validateInvoiceTotalsConsistency(value.lineItems, value, context);
  });

export const createInvoiceFromWorkOrderSchema = invoiceDraftPayloadSchema;

export const updateInvoiceDraftSchema = invoiceDraftPayloadSchema.safeExtend({
  invoiceId: entityIdSchema,
});

export const sendInvoiceSchema = z
  .object({
    workOrderId: entityIdSchema,
    invoiceId: entityIdSchema,
    issuedDate: isoDateStringSchema.optional(),
    sentAt: isoDateStringSchema.optional(),
  })
  .superRefine((value, context) => {
    if (value.issuedDate && value.sentAt) {
      const issuedAt = Date.parse(value.issuedDate);
      const sentAt = Date.parse(value.sentAt);
      if (sentAt < issuedAt) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "sentAt cannot be earlier than issuedDate.",
          path: ["sentAt"],
        });
      }
    }
  });

export const markInvoiceViewedSchema = z.object({
  workOrderId: entityIdSchema,
  invoiceId: entityIdSchema,
  viewedAt: isoDateStringSchema.optional(),
});

export const markInvoicePaidSchema = z.object({
  workOrderId: entityIdSchema,
  invoiceId: entityIdSchema,
  paidAt: isoDateStringSchema.optional(),
  paymentReference: nullableTrimmedStringSchema,
});

export const voidInvoiceSchema = z.object({
  workOrderId: entityIdSchema,
  invoiceId: entityIdSchema,
  voidedAt: isoDateStringSchema.optional(),
});

export function validateInvoiceForm(
  formData: FormData,
): InvoiceFormValidationResult {
  const dueDate = readTrimmedString(formData, "dueDate");
  const currency = readTrimmedString(formData, "currency");
  const taxAmount = readMoney(formData, "taxAmount");
  const notes = readNullableTrimmedString(formData, "notes")
    ?? readNullableTrimmedString(formData, "internalFinanceNotes");
  const paymentReference = readNullableTrimmedString(
    formData,
    "paymentReference",
  );
  const lineItems = readLineItems(formData);
  const errors: InvoiceFormErrors = {};

  if (!dueDate || Number.isNaN(Date.parse(dueDate))) {
    errors.dueDate = "Due date is required.";
  }

  if (currency !== "CAD" && currency !== "USD") {
    errors.currency = "Currency is required.";
  }

  if (taxAmount === null) {
    errors.taxAmount = "Tax amount must be a number greater than or equal to 0.";
  }

  if (lineItems.length === 0) {
    errors.lineItems = "At least one valid line item is required.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const subtotal = calculateInvoiceSubtotal(lineItems);
  const totalAmount = calculateInvoiceTotal(subtotal, taxAmount ?? 0);

  return {
    ok: true,
    data: {
      dueDate,
      currency: currency === "USD" ? "USD" : "CAD",
      lineItems,
      taxAmount: taxAmount ?? 0,
      subtotal,
      totalAmount,
      notes,
      paymentReference,
    },
  };
}

export function canInvoiceStatusTransition(
  from: InvoiceStatus,
  to: InvoiceStatus,
): boolean {
  return (
    invoiceStatusTransitions[from] as readonly InvoiceStatus[]
  ).includes(to);
}

function validateInvoiceTotalsConsistency(
  lineItems: InvoiceLineItem[],
  totals: z.infer<typeof invoiceMoneyFieldsSchema>,
  context: z.RefinementCtx,
): void {
  const expectedSubtotal = roundMoney(
    lineItems.reduce((sum, item) => sum + item.lineTotal, 0),
  );
  const providedSubtotal = totals.subtotal ?? expectedSubtotal;
  const expectedTotal = roundMoney(providedSubtotal + totals.taxAmount);
  const providedTotal = totals.totalAmount ?? expectedTotal;

  if (providedSubtotal !== expectedSubtotal) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "subtotal must equal the sum of all line item totals.",
      path: ["subtotal"],
    });
  }

  if (providedTotal !== expectedTotal) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "totalAmount must equal subtotal plus taxAmount.",
      path: ["totalAmount"],
    });
  }
}

function readLineItems(formData: FormData): InvoiceLineItem[] {
  const count = Number(readTrimmedString(formData, "lineItemCount"));
  const rowCount = Number.isInteger(count) && count > 0 ? count : 0;
  const lineItems: InvoiceLineItem[] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const description = readTrimmedString(formData, `lineItemDescription-${index}`);
    const quantity = readPositiveNumber(formData, `lineItemQuantity-${index}`);
    const unitPrice = readMoney(formData, `lineItemUnitPrice-${index}`);

    if (!description && quantity === null && unitPrice === null) {
      continue;
    }

    if (!description || quantity === null || unitPrice === null) {
      return [];
    }

    lineItems.push({
      id: readTrimmedString(formData, `lineItemId-${index}`) || `line-${index}`,
      description,
      quantity,
      unitPrice,
      lineTotal: calculateInvoiceLineTotal(quantity, unitPrice),
    });
  }

  return lineItems;
}

function readTrimmedString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function readNullableTrimmedString(
  formData: FormData,
  field: string,
): string | null {
  const value = readTrimmedString(formData, field);
  return value ? value : null;
}

function readMoney(formData: FormData, field: string): number | null {
  const value = readTrimmedString(formData, field);
  if (!value) {
    return null;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return roundMoney(amount);
}

function readPositiveNumber(formData: FormData, field: string): number | null {
  const value = readTrimmedString(formData, field);
  if (!value) {
    return null;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }

  return roundMoney(amount);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
