"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  getContractorPortalActionTarget,
} from "@/modules/contractors/server/contractor-portal";
import { getContractorPortalActionAvailability } from "@/modules/work-orders/contractor-portal";

export interface ContractorPortalFormState {
  ok: boolean;
  message?: string;
  errors?: Record<string, string>;
}

const EMPTY_FORM_STATE: ContractorPortalFormState = { ok: false };

export async function acceptContractorAssignmentAction(
  _previousState: ContractorPortalFormState = EMPTY_FORM_STATE,
  formData: FormData,
): Promise<ContractorPortalFormState> {
  return updateAssignmentStatus(formData, "accepted");
}

export async function declineContractorAssignmentAction(
  _previousState: ContractorPortalFormState = EMPTY_FORM_STATE,
  formData: FormData,
): Promise<ContractorPortalFormState> {
  return updateAssignmentStatus(formData, "declined", readOptionalString(formData, "declineReason"));
}

export async function completeContractorAssignmentAction(
  _previousState: ContractorPortalFormState = EMPTY_FORM_STATE,
  formData: FormData,
): Promise<ContractorPortalFormState> {
  return updateAssignmentStatus(formData, "completed", readOptionalString(formData, "completionNotes"));
}

export async function submitContractorQuoteAction(
  _previousState: ContractorPortalFormState = EMPTY_FORM_STATE,
  formData: FormData,
): Promise<ContractorPortalFormState> {
  const workOrderId = readRequiredString(formData, "workOrderId");
  if (!workOrderId) {
    return { ok: false, message: "Work order could not be found." };
  }

  const { context, workOrder, assignment, quote } =
    await getContractorPortalActionTarget(workOrderId);
  const actionAvailability = getContractorPortalActionAvailability({
    workOrder,
    assignment,
    quote,
  });

  if (!actionAvailability.canSubmitQuote) {
    return {
      ok: false,
      message: "This work order is not currently eligible for contractor quote submission.",
    };
  }

  const laborAmount = readMoney(formData, "laborAmount");
  const materialAmount = readMoney(formData, "materialAmount");
  const otherAmount = readMoney(formData, "otherAmount");
  const scopeSummary = readRequiredString(formData, "scopeSummary");
  const contractorNotes = readOptionalString(formData, "contractorNotes");

  const errors: Record<string, string> = {};
  if (laborAmount === null) {
    errors.laborAmount = "Enter a valid labor amount.";
  }
  if (materialAmount === null) {
    errors.materialAmount = "Enter a valid material amount.";
  }
  if (otherAmount === null) {
    errors.otherAmount = "Enter a valid other amount.";
  }
  if (!scopeSummary) {
    errors.scopeSummary = "Scope summary is required.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      errors,
    };
  }

  const draftResult =
    quote && quote.status === "draft"
      ? await context.services.quotes.updateDraft({
          ...context.audit,
          workOrderId,
          quoteId: quote.id,
          contractorOrganizationId: context.actor.scope.contractorOrganizationId,
          laborAmount: laborAmount!,
          materialAmount: materialAmount!,
          otherAmount: otherAmount!,
          currency: quote.currency,
          scopeSummary,
          contractorNotes,
        })
      : await context.services.quotes.create({
          ...context.audit,
          workOrderId,
          contractorOrganizationId: context.actor.scope.contractorOrganizationId,
          laborAmount: laborAmount!,
          materialAmount: materialAmount!,
          otherAmount: otherAmount!,
          currency: "USD",
          scopeSummary,
          contractorNotes,
        });

  if (!draftResult.ok) {
    return { ok: false, message: draftResult.error.safeMessage };
  }

  const submittedResult = await context.services.quotes.transition({
    ...context.audit,
    workOrderId,
    quoteId: draftResult.value.id,
    toStatus: "submitted",
  });

  if (!submittedResult.ok) {
    return { ok: false, message: submittedResult.error.safeMessage };
  }

  revalidateContractorPortal(workOrderId);
  redirect(`/contractor/work-orders/${workOrderId}`);
}

async function updateAssignmentStatus(
  formData: FormData,
  status: "accepted" | "declined" | "completed",
  notes?: string | null,
): Promise<ContractorPortalFormState> {
  const workOrderId = readRequiredString(formData, "workOrderId");
  if (!workOrderId) {
    return { ok: false, message: "Work order could not be found." };
  }

  const { context, workOrder, assignment, quote } =
    await getContractorPortalActionTarget(workOrderId);
  const actionAvailability = getContractorPortalActionAvailability({
    workOrder,
    assignment,
    quote,
  });

  const isAllowed =
    (status === "accepted" && actionAvailability.canAcceptAssignment) ||
    (status === "declined" && actionAvailability.canDeclineAssignment) ||
    (status === "completed" && actionAvailability.canCompleteAssignment);

  if (!isAllowed) {
    return {
      ok: false,
      message: "This assignment update is not available.",
    };
  }

  const result = await context.services.assignments.updateStatus({
    ...context.audit,
    workOrderId,
    assignmentId: assignment.id,
    status,
    notes: notes ?? null,
  });

  if (!result.ok) {
    return { ok: false, message: result.error.safeMessage };
  }

  revalidateContractorPortal(workOrderId);
  redirect(`/contractor/work-orders/${workOrderId}`);
}

function revalidateContractorPortal(workOrderId: string): void {
  revalidatePath("/contractor/dashboard");
  revalidatePath("/contractor/work-orders");
  revalidatePath(`/contractor/work-orders/${workOrderId}`);
  revalidatePath(`/contractor/work-orders/${workOrderId}/quote`);
}

function readRequiredString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalString(formData: FormData, field: string): string | null {
  const value = formData.get(field);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readMoney(formData: FormData, field: string): number | null {
  const value = formData.get(field);
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) {
    return null;
  }

  return Math.round(amount * 100) / 100;
}
