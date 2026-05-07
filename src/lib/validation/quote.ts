import { calculateQuoteTotal } from "@/lib/quotes/money";
import { z } from "zod";
import type {
  ClientQuoteStatus,
  ContractorQuoteStatus,
  QuoteDecisionAction,
} from "@/types/quote";

export interface QuoteFormErrors {
  contractorName?: string;
  laborAmount?: string;
  materialAmount?: string;
  otherAmount?: string;
  scopeSummary?: string;
  form?: string;
}

export type QuoteFormValidationResult =
  | {
      ok: true;
      data: {
        contractorName: string;
        assignedContractorId: string | null;
        laborAmount: number;
        materialAmount: number;
        otherAmount: number;
        totalAmount: number;
        scopeSummary: string;
        contractorNotes: string | null;
      };
      errors?: never;
    }
  | { ok: false; data?: never; errors: QuoteFormErrors };

export function validateQuoteForm(formData: FormData): QuoteFormValidationResult {
  const contractorName = readTrimmedString(formData, "contractorName");
  const assignedContractorId = readNullableTrimmedString(
    formData,
    "assignedContractorId",
  );
  const scopeSummary = readTrimmedString(formData, "scopeSummary");
  const contractorNotes = readNullableTrimmedString(formData, "contractorNotes");
  const laborAmount = readMoney(formData, "laborAmount");
  const materialAmount = readMoney(formData, "materialAmount");
  const otherAmount = readMoney(formData, "otherAmount");
  const errors: QuoteFormErrors = {};

  if (!contractorName) {
    errors.contractorName = "Contractor name is required.";
  }

  if (!scopeSummary) {
    errors.scopeSummary = "Scope summary is required.";
  }

  if (laborAmount === null) {
    errors.laborAmount = "Labor amount must be a number greater than or equal to 0.";
  }

  if (materialAmount === null) {
    errors.materialAmount = "Material amount must be a number greater than or equal to 0.";
  }

  if (otherAmount === null) {
    errors.otherAmount = "Other amount must be a number greater than or equal to 0.";
  }

  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }

  const validLaborAmount = laborAmount ?? 0;
  const validMaterialAmount = materialAmount ?? 0;
  const validOtherAmount = otherAmount ?? 0;
  const totalAmount = calculateQuoteTotal(
    validLaborAmount,
    validMaterialAmount,
    validOtherAmount,
  );

  return {
    ok: true,
    data: {
      contractorName,
      assignedContractorId,
      laborAmount: validLaborAmount,
      materialAmount: validMaterialAmount,
      otherAmount: validOtherAmount,
      totalAmount,
      scopeSummary,
      contractorNotes,
    },
  };
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

  return Math.round(amount * 100) / 100;
}

const nonEmptyStringSchema = z.string().trim().min(1);
const nullableTrimmedStringSchema = z.string().trim().min(1).nullable().optional();
const entityIdSchema = z.string().trim().min(1);
const moneySchema = z
  .number()
  .finite()
  .nonnegative()
  .transform((value) => Math.round(value * 100) / 100);
const positiveQuantitySchema = z.number().finite().positive();

export const contractorQuoteStatuses = [
  "draft",
  "submitted",
  "under_review",
  "accepted",
  "rejected",
  "expired",
  "cancelled",
] as const satisfies readonly ContractorQuoteStatus[];

export const clientQuoteStatuses = [
  "draft",
  "sent",
  "approved",
  "rejected",
  "expired",
  "cancelled",
] as const satisfies readonly ClientQuoteStatus[];

export const quoteDecisionActions = [
  "accept_contractor_quote",
  "reject_contractor_quote",
  "send_client_quote",
  "approve_client_quote",
  "reject_client_quote",
] as const satisfies readonly QuoteDecisionAction[];

export const quoteLineItemSchema = z
  .object({
    description: nonEmptyStringSchema,
    quantity: positiveQuantitySchema,
    unitPrice: moneySchema,
    lineTotal: moneySchema,
  })
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

const quoteMoneyFieldsSchema = z.object({
  subtotal: moneySchema,
  taxAmount: moneySchema,
  totalAmount: moneySchema,
});

const quoteBaseSchema = z
  .object({
    workOrderId: entityIdSchema,
    lineItems: z.array(quoteLineItemSchema),
    subtotal: moneySchema,
    taxAmount: moneySchema,
    totalAmount: moneySchema,
    notes: nullableTrimmedStringSchema,
  })
  .superRefine((value, context) => {
    validateQuoteTotalsConsistency(value.lineItems, value, context);
  });

export const saveContractorQuoteDraftSchema = quoteBaseSchema.safeExtend({
  contractorQuoteId: entityIdSchema.optional(),
  contractorUserId: entityIdSchema.nullable().optional(),
  contractorOrganizationId: entityIdSchema.nullable().optional(),
});

export const submitContractorQuoteSchema = saveContractorQuoteDraftSchema.superRefine(
  (value, context) => {
    if (value.lineItems.length < 1) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one line item is required to submit a contractor quote.",
        path: ["lineItems"],
      });
    }
  },
);

export const reviewContractorQuoteSchema = z
  .object({
    workOrderId: entityIdSchema,
    contractorQuoteId: entityIdSchema,
    action: z.enum(["accept_contractor_quote", "reject_contractor_quote"]),
    rejectionReason: nullableTrimmedStringSchema,
  })
  .superRefine((value, context) => {
    if (
      value.action === "reject_contractor_quote" &&
      !value.rejectionReason?.trim()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Rejection reason is required when rejecting a contractor quote.",
        path: ["rejectionReason"],
      });
    }
  });

export const createClientQuoteSchema = quoteBaseSchema.safeExtend({
  sourceContractorQuoteId: entityIdSchema.nullable().optional(),
});

export const sendClientQuoteSchema = z.object({
  workOrderId: entityIdSchema,
  clientQuoteId: entityIdSchema,
});

export const approveClientQuoteSchema = z.object({
  workOrderId: entityIdSchema,
  clientQuoteId: entityIdSchema,
  status: z.literal("approved"),
});

export const rejectClientQuoteSchema = z.object({
  workOrderId: entityIdSchema,
  clientQuoteId: entityIdSchema,
  status: z.literal("rejected"),
  rejectionReason: nonEmptyStringSchema,
});

export function canTransitionContractorQuote(
  from: ContractorQuoteStatus,
  to: ContractorQuoteStatus,
): boolean {
  const transitions: Record<ContractorQuoteStatus, readonly ContractorQuoteStatus[]> = {
    draft: ["submitted"],
    submitted: ["under_review", "accepted", "rejected", "cancelled"],
    under_review: ["accepted", "rejected"],
    rejected: [],
    accepted: [],
    expired: [],
    cancelled: [],
  };

  return transitions[from].includes(to);
}

export function canTransitionClientQuote(
  from: ClientQuoteStatus,
  to: ClientQuoteStatus,
): boolean {
  const transitions: Record<ClientQuoteStatus, readonly ClientQuoteStatus[]> = {
    draft: ["sent", "expired"],
    sent: ["approved", "rejected", "expired"],
    approved: [],
    rejected: [],
    expired: [],
    cancelled: [],
  };

  return transitions[from].includes(to);
}

function validateQuoteTotalsConsistency(
  lineItems: Array<{ lineTotal: number }>,
  totals: z.infer<typeof quoteMoneyFieldsSchema>,
  context: z.RefinementCtx,
): void {
  const expectedSubtotal = roundMoney(
    lineItems.reduce((sum, item) => sum + item.lineTotal, 0),
  );

  if (expectedSubtotal !== totals.subtotal) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "subtotal must equal the sum of all line item totals.",
      path: ["subtotal"],
    });
  }

  if (roundMoney(totals.subtotal + totals.taxAmount) !== totals.totalAmount) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "totalAmount must equal subtotal plus taxAmount.",
      path: ["totalAmount"],
    });
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
