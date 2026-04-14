"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canSubmitContractorQuote,
  canUpdateContractorExecutionStatus,
} from "../permissions/contractor-permissions.ts";
import { getMockContractorCurrentUser } from "../permissions/contractor-session.ts";
import {
  createQuote,
  getCurrentQuoteForWorkOrder,
  submitQuote,
  updateQuoteDraft,
} from "../quotes/repository.ts";
import { validateQuoteForm, type QuoteFormErrors } from "../validation/quote.ts";
import {
  getWorkOrderById,
  updateContractorExecutionStatus,
} from "../work-orders/repository.ts";
import { USER_ROLES } from "../../types/permissions.ts";

export interface ContractorQuoteFormState {
  ok: boolean;
  message?: string;
  errors?: QuoteFormErrors;
}

export interface ContractorStatusFormState {
  ok: boolean;
  message?: string;
}

export async function submitContractorQuoteAction(
  _previousState: ContractorQuoteFormState,
  formData: FormData,
): Promise<ContractorQuoteFormState> {
  const context = await getMockContractorCurrentUser(
    readString(formData, "contractorId"),
  );
  const workOrderId = readString(formData, "workOrderId");
  const workOrder = await getWorkOrderById(workOrderId);

  if (!context || !workOrder) {
    return { ok: false, message: "Work order could not be found." };
  }

  if (!canSubmitContractorQuote(USER_ROLES.ContractorUser, workOrder, context)) {
    return { ok: false, message: "This work order is not ready for your quote." };
  }

  const validation = validateQuoteForm(formData);
  if (!validation.ok) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      errors: validation.errors,
    };
  }

  const actor = { name: context.name, role: USER_ROLES.ContractorUser };
  const input = {
    ...validation.data,
    assignedContractorId: context.contractorId,
    contractorName:
      workOrder.assignedContractorName ?? validation.data.contractorName,
  };
  const currentQuote = await getCurrentQuoteForWorkOrder(workOrderId);
  const quote =
    currentQuote?.status === "draft" &&
    currentQuote.assignedContractorId === context.contractorId
      ? await updateQuoteDraft(workOrderId, currentQuote.id, input, actor)
      : await createQuote(workOrderId, input, actor);

  if (!quote) {
    return { ok: false, message: "Quote could not be saved." };
  }

  await submitQuote(workOrderId, quote.id, actor);
  revalidateContractorWorkOrder(workOrderId);
  redirect(
    `/contractor/work-orders/${workOrderId}?contractorId=${context.contractorId}`,
  );
}

export async function updateContractorExecutionStatusAction(
  _previousState: ContractorStatusFormState,
  formData: FormData,
): Promise<ContractorStatusFormState> {
  const context = await getMockContractorCurrentUser(
    readString(formData, "contractorId"),
  );
  const workOrderId = readString(formData, "workOrderId");
  const nextStatus = readString(formData, "nextStatus");
  const workOrder = await getWorkOrderById(workOrderId);

  if (!context || !workOrder) {
    return { ok: false, message: "Work order could not be found." };
  }

  if (nextStatus !== "in_progress" && nextStatus !== "completed") {
    return { ok: false, message: "Requested status is invalid." };
  }

  if (
    !canUpdateContractorExecutionStatus(
      USER_ROLES.ContractorUser,
      workOrder,
      context,
      nextStatus,
    )
  ) {
    return { ok: false, message: "This status update is not available." };
  }

  const completionNotes =
    nextStatus === "completed" ? readString(formData, "completionNotes") : null;
  if (nextStatus === "completed" && !completionNotes) {
    return { ok: false, message: "Completion notes are required." };
  }

  await updateContractorExecutionStatus(
    workOrderId,
    nextStatus,
    completionNotes,
    { name: context.name, role: USER_ROLES.ContractorUser },
  );
  revalidateContractorWorkOrder(workOrderId);
  redirect(
    `/contractor/work-orders/${workOrderId}?contractorId=${context.contractorId}`,
  );
}

function revalidateContractorWorkOrder(workOrderId: string): void {
  revalidatePath("/dashboard");
  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/contractor/dashboard");
  revalidatePath("/contractor/work-orders");
  revalidatePath(`/contractor/work-orders/${workOrderId}`);
}

function readString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}
