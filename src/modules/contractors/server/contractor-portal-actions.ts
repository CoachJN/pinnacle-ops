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

  const lineItems = readQuoteLineItems(formData);
  const taxAmount = readMoney(formData, "taxAmount");
  const notes = readOptionalString(formData, "notes");

  const errors: Record<string, string> = {};
  if (lineItems.length < 1) {
    errors.lineItems = "Add at least one valid line item.";
  }
  if (taxAmount === null) {
    errors.taxAmount = "Enter a valid tax amount.";
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      errors,
    };
  }

  const subtotal = roundMoney(
    lineItems.reduce((sum, lineItem) => sum + lineItem.lineTotal, 0),
  );
  const submittedResult = await context.services.quoteWorkflow.submitContractorQuote({
    ...context.audit,
    workOrderId,
    contractorQuoteId: quote?.status === "draft" ? quote.id : undefined,
    contractorUserId: context.actor.userId,
    contractorOrganizationId: context.actor.scope.contractorOrganizationId,
    lineItems,
    subtotal,
    taxAmount: taxAmount!,
    totalAmount: roundMoney(subtotal + taxAmount!),
    notes,
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

  return roundMoney(amount);
}

function readQuoteLineItems(
  formData: FormData,
): Array<{
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}> {
  const value = formData.get("lineItemsJson");
  if (typeof value !== "string" || !value.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") {
        return [];
      }

      const description =
        typeof item.description === "string" ? item.description.trim() : "";
      const quantity = typeof item.quantity === "number" ? item.quantity : Number.NaN;
      const unitPrice =
        typeof item.unitPrice === "number" ? item.unitPrice : Number.NaN;

      if (
        !description ||
        !Number.isFinite(quantity) ||
        quantity <= 0 ||
        !Number.isFinite(unitPrice) ||
        unitPrice < 0
      ) {
        return [];
      }

      const normalizedQuantity = roundMoney(quantity);
      const normalizedUnitPrice = roundMoney(unitPrice);

      return [
        {
          description,
          quantity: normalizedQuantity,
          unitPrice: normalizedUnitPrice,
          lineTotal: roundMoney(normalizedQuantity * normalizedUnitPrice),
        },
      ];
    });
  } catch {
    return [];
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
