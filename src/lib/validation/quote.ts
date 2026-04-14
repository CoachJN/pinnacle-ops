import type { QuoteFormInput } from "@/types/quote";
import { calculateQuoteTotal } from "@/lib/quotes/money";

export interface QuoteFormErrors {
  contractorName?: string;
  laborAmount?: string;
  materialAmount?: string;
  otherAmount?: string;
  scopeSummary?: string;
  form?: string;
}

export type QuoteFormValidationResult =
  | { ok: true; data: QuoteFormInput & { totalAmount: number }; errors?: never }
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
