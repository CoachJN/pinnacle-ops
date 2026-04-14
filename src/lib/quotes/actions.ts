"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canCreateQuote,
  canCreateQuoteRevision,
  canEditQuote,
  canMarkRequiresQuote,
  canRecordClientApproval,
  canRecordClientRejection,
  canRequestQuote,
  canReviewQuote,
  canSendQuoteToClient,
  canSubmitQuote,
} from "@/lib/permissions/quote-permissions";
import {
  resolveActionActor,
  unauthorizedActionMessage,
} from "@/lib/permissions/resolve-action-actor";
import {
  createQuote,
  getQuoteById,
  getCurrentQuoteForWorkOrder,
  markQuoteUnderReview,
  recordClientQuoteDecision,
  sendQuoteToClientApproval,
  submitQuote,
  updateQuoteDraft,
} from "@/lib/quotes/repository";
import {
  addWorkOrderActivity,
  getWorkOrderById,
  setWorkOrderQuoteRequirement,
  transitionWorkOrderStatus,
} from "@/lib/work-orders/repository";
import { validateQuoteForm, type QuoteFormErrors } from "@/lib/validation/quote";

export interface QuoteActionState {
  ok: boolean;
  message?: string;
  errors?: QuoteFormErrors;
}

const emptyActionState: QuoteActionState = { ok: false };

export async function markRequiresQuoteFormAction(formData: FormData) {
  await markRequiresQuoteAction(emptyActionState, formData);
}

export async function requestQuoteFormAction(formData: FormData) {
  await requestQuoteAction(emptyActionState, formData);
}

export async function submitQuoteFormAction(formData: FormData) {
  await submitQuoteAction(emptyActionState, formData);
}

export async function markQuoteUnderReviewFormAction(formData: FormData) {
  await markQuoteUnderReviewAction(emptyActionState, formData);
}

export async function sendQuoteToClientFormAction(formData: FormData) {
  await sendQuoteToClientAction(emptyActionState, formData);
}

export async function recordClientApprovalFormAction(formData: FormData) {
  await recordClientApprovalAction(emptyActionState, formData);
}

export async function recordClientRejectionFormAction(formData: FormData) {
  await recordClientRejectionAction(emptyActionState, formData);
}

export async function createQuoteRevisionFormAction(formData: FormData) {
  await createQuoteRevisionAction(emptyActionState, formData);
}

export async function markRequiresQuoteAction(
  _previousState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const actor = await getActor(formData);
  if (!actor) {
    return { ok: false, message: unauthorizedActionMessage() };
  }
  const workOrderId = readString(formData, "workOrderId");
  const workOrder = await getWorkOrderById(workOrderId);

  if (!workOrder) {
    return { ok: false, message: "Work order could not be found." };
  }

  if (!canMarkRequiresQuote(actor.role, workOrder)) {
    return { ok: false, message: "You cannot change quote requirement for this work order." };
  }

  await setWorkOrderQuoteRequirement(workOrderId, true, actor);
  revalidateWorkOrder(workOrderId);
  redirect(`/work-orders/${workOrderId}?role=${actor.role}`);
}

export async function requestQuoteAction(
  _previousState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const actor = await getActor(formData);
  if (!actor) {
    return { ok: false, message: unauthorizedActionMessage() };
  }
  const workOrderId = readString(formData, "workOrderId");
  const workOrder = await getWorkOrderById(workOrderId);

  if (!workOrder) {
    return { ok: false, message: "Work order could not be found." };
  }

  if (!canRequestQuote(actor.role, workOrder)) {
    return { ok: false, message: "You cannot request a quote for this work order state." };
  }

  await transitionWorkOrderStatus(workOrderId, "quote_requested", actor);
  await addWorkOrderActivity(workOrderId, {
    type: "quote_requested",
    message: "Requested a contractor quote for this work order.",
    actor,
  });
  revalidateWorkOrder(workOrderId);
  redirect(`/work-orders/${workOrderId}?role=${actor.role}`);
}

export async function createQuoteAction(
  _previousState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const actor = await getActor(formData);
  if (!actor) {
    return { ok: false, message: unauthorizedActionMessage() };
  }
  const workOrderId = readString(formData, "workOrderId");
  const workOrder = await getWorkOrderById(workOrderId);

  if (!workOrder) {
    return { ok: false, message: "Work order could not be found." };
  }

  const currentQuote = await getCurrentQuoteForWorkOrder(workOrderId);
  const canCreate =
    canCreateQuote(actor.role, workOrder) ||
    (currentQuote
      ? canCreateQuoteRevision(actor.role, workOrder, currentQuote)
      : false);

  if (!canCreate) {
    return { ok: false, message: "You cannot create a quote for this work order." };
  }

  const validation = validateQuoteForm(formData);
  if (!validation.ok) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      errors: validation.errors,
    };
  }

  const quote = await createQuote(workOrderId, validation.data, actor);
  if (!quote) {
    return { ok: false, message: "Quote could not be created." };
  }

  revalidateWorkOrder(workOrderId);
  redirect(`/work-orders/${workOrderId}?role=${actor.role}`);
}

export async function updateQuoteAction(
  _previousState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const actor = await getActor(formData);
  if (!actor) {
    return { ok: false, message: unauthorizedActionMessage() };
  }
  const workOrderId = readString(formData, "workOrderId");
  const quoteId = readString(formData, "quoteId");
  const [workOrder, quote] = await Promise.all([
    getWorkOrderById(workOrderId),
    getQuoteById(workOrderId, quoteId),
  ]);

  if (!workOrder || !quote) {
    return { ok: false, message: "Quote could not be found for this work order." };
  }

  if (!canEditQuote(actor.role, workOrder, quote)) {
    return { ok: false, message: "This quote is not editable for your role or state." };
  }

  const validation = validateQuoteForm(formData);
  if (!validation.ok) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      errors: validation.errors,
    };
  }

  await updateQuoteDraft(workOrderId, quoteId, validation.data, actor);
  revalidateWorkOrder(workOrderId);
  redirect(`/work-orders/${workOrderId}?role=${actor.role}`);
}

export async function submitQuoteAction(
  _previousState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const actor = await getActor(formData);
  if (!actor) {
    return { ok: false, message: unauthorizedActionMessage() };
  }
  const workOrderId = readString(formData, "workOrderId");
  const quoteId = readString(formData, "quoteId");
  const [workOrder, quote] = await Promise.all([
    getWorkOrderById(workOrderId),
    getQuoteById(workOrderId, quoteId),
  ]);

  if (!workOrder || !quote) {
    return { ok: false, message: "Quote could not be found for this work order." };
  }

  if (!canSubmitQuote(actor.role, workOrder, quote)) {
    return { ok: false, message: "You cannot submit this quote." };
  }

  await submitQuote(workOrderId, quoteId, actor);
  revalidateWorkOrder(workOrderId);
  redirect(`/work-orders/${workOrderId}?role=${actor.role}`);
}

export async function markQuoteUnderReviewAction(
  _previousState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const actor = await getActor(formData);
  if (!actor) {
    return { ok: false, message: unauthorizedActionMessage() };
  }
  const { workOrder, quote, workOrderId, quoteId } = await getQuoteContext(formData);

  if (!workOrder || !quote) {
    return { ok: false, message: "Quote could not be found for this work order." };
  }

  if (!canReviewQuote(actor.role, workOrder, quote) || quote.status !== "submitted") {
    return { ok: false, message: "You cannot mark this quote under review." };
  }

  await markQuoteUnderReview(
    workOrderId,
    quoteId,
    readNullableString(formData, "internalReviewNotes"),
    actor,
  );
  revalidateWorkOrder(workOrderId);
  redirect(`/work-orders/${workOrderId}?role=${actor.role}`);
}

export async function sendQuoteToClientAction(
  _previousState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const actor = await getActor(formData);
  if (!actor) {
    return { ok: false, message: unauthorizedActionMessage() };
  }
  const { workOrder, quote, workOrderId, quoteId } = await getQuoteContext(formData);

  if (!workOrder || !quote) {
    return { ok: false, message: "Quote could not be found for this work order." };
  }

  if (!canSendQuoteToClient(actor.role, workOrder, quote)) {
    return { ok: false, message: "You cannot send this quote for client approval." };
  }

  await sendQuoteToClientApproval(
    workOrderId,
    quoteId,
    readNullableString(formData, "internalReviewNotes"),
    actor,
  );
  revalidateWorkOrder(workOrderId);
  redirect(`/work-orders/${workOrderId}?role=${actor.role}`);
}

export async function recordClientApprovalAction(
  _previousState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  return recordClientDecision(formData, "approved");
}

export async function recordClientRejectionAction(
  _previousState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  return recordClientDecision(formData, "rejected");
}

export async function createQuoteRevisionAction(
  _previousState: QuoteActionState,
  formData: FormData,
): Promise<QuoteActionState> {
  const actor = await getActor(formData);
  if (!actor) {
    return { ok: false, message: unauthorizedActionMessage() };
  }
  const workOrderId = readString(formData, "workOrderId");
  const workOrder = await getWorkOrderById(workOrderId);
  const currentQuote = await getCurrentQuoteForWorkOrder(workOrderId);

  if (!workOrder || !currentQuote) {
    return { ok: false, message: "Current quote could not be found." };
  }

  if (!canCreateQuoteRevision(actor.role, workOrder, currentQuote)) {
    return { ok: false, message: "You cannot create a revised quote for this work order." };
  }

  redirect(`/work-orders/${workOrderId}/quotes/new?role=${actor.role}`);
}

async function recordClientDecision(
  formData: FormData,
  decision: "approved" | "rejected",
): Promise<QuoteActionState> {
  const actor = await getActor(formData);
  if (!actor) {
    return { ok: false, message: unauthorizedActionMessage() };
  }
  const { workOrder, quote, workOrderId, quoteId } = await getQuoteContext(formData);

  if (!workOrder || !quote) {
    return { ok: false, message: "Quote could not be found for this work order." };
  }

  const allowed =
    decision === "approved"
      ? canRecordClientApproval(actor.role, workOrder, quote)
      : canRecordClientRejection(actor.role, workOrder, quote);

  if (!allowed) {
    return { ok: false, message: "You cannot record this client decision." };
  }

  await recordClientQuoteDecision(
    workOrderId,
    quoteId,
    decision,
    readNullableString(formData, "clientResponseNotes"),
    actor,
  );
  revalidateWorkOrder(workOrderId);
  redirect(`/work-orders/${workOrderId}?role=${actor.role}`);
}

async function getQuoteContext(formData: FormData) {
  const workOrderId = readString(formData, "workOrderId");
  const quoteId = readString(formData, "quoteId");
  const [workOrder, quote] = await Promise.all([
    getWorkOrderById(workOrderId),
    getQuoteById(workOrderId, quoteId),
  ]);

  return { workOrder, quote, workOrderId, quoteId };
}

async function getActor(formData: FormData) {
  const actorRole = readString(formData, "actorRole");
  return resolveActionActor(actorRole);
}

function readString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function readNullableString(formData: FormData, field: string): string | null {
  const value = readString(formData, field);
  return value ? value : null;
}

function revalidateWorkOrder(workOrderId: string): void {
  revalidatePath("/work-orders");
  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/dashboard");
}
