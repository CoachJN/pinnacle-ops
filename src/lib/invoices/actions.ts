"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canClosePaidWorkOrder,
  canCreateInvoice,
  canEditInvoice,
  canIssueInvoice,
  canMarkInvoiceOverdue,
  canMarkInvoicePaid,
  canVoidInvoice,
} from "@/lib/permissions/invoice-permissions";
import {
  resolveActionActor,
  unauthorizedActionMessage,
} from "@/lib/permissions/resolve-action-actor";
import {
  closePaidWorkOrder,
  createInvoice,
  getCurrentInvoiceForWorkOrder,
  getInvoiceById,
  issueInvoice,
  markInvoiceOverdue,
  markInvoicePaid,
  updateInvoiceDraft,
  voidInvoice,
} from "@/lib/invoices/repository";
import { getWorkOrderById } from "@/lib/work-orders/repository";
import {
  validateInvoiceForm,
  type InvoiceFormErrors,
} from "@/lib/validation/invoice";

export interface InvoiceActionState {
  ok: boolean;
  message?: string;
  errors?: InvoiceFormErrors;
}

const emptyActionState: InvoiceActionState = { ok: false };

export async function issueInvoiceFormAction(formData: FormData) {
  await issueInvoiceAction(emptyActionState, formData);
}

export async function markInvoicePaidFormAction(formData: FormData) {
  await markInvoicePaidAction(emptyActionState, formData);
}

export async function markInvoiceOverdueFormAction(formData: FormData) {
  await markInvoiceOverdueAction(emptyActionState, formData);
}

export async function voidInvoiceFormAction(formData: FormData) {
  await voidInvoiceAction(emptyActionState, formData);
}

export async function closePaidWorkOrderFormAction(formData: FormData) {
  await closePaidWorkOrderAction(emptyActionState, formData);
}

export async function createInvoiceAction(
  _previousState: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const actor = await getActor(formData);
  if (!actor) {
    return { ok: false, message: unauthorizedActionMessage() };
  }
  const workOrderId = readString(formData, "workOrderId");
  const workOrder = await getWorkOrderById(workOrderId);

  if (!workOrder) {
    return { ok: false, message: "Work order could not be found." };
  }

  if (!canCreateInvoice(actor.role, workOrder)) {
    return {
      ok: false,
      message: "You cannot create an invoice for this work order state.",
    };
  }

  const validation = validateInvoiceForm(formData);
  if (!validation.ok) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      errors: validation.errors,
    };
  }

  await createInvoice(workOrderId, validation.data, actor);
  revalidateWorkOrder(workOrderId);
  redirect(`/work-orders/${workOrderId}?role=${actor.role}`);
}

export async function updateInvoiceAction(
  _previousState: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const actor = await getActor(formData);
  if (!actor) {
    return { ok: false, message: unauthorizedActionMessage() };
  }
  const { workOrder, invoice, workOrderId, invoiceId } =
    await getInvoiceContext(formData);

  if (!workOrder || !invoice) {
    return { ok: false, message: "Invoice could not be found for this work order." };
  }

  if (!canEditInvoice(actor.role, workOrder, invoice)) {
    return {
      ok: false,
      message: "This invoice is not editable for your role or state.",
    };
  }

  const validation = validateInvoiceForm(formData);
  if (!validation.ok) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      errors: validation.errors,
    };
  }

  await updateInvoiceDraft(workOrderId, invoiceId, validation.data, actor);
  revalidateWorkOrder(workOrderId);
  redirect(`/work-orders/${workOrderId}?role=${actor.role}`);
}

export async function issueInvoiceAction(
  _previousState: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const actor = await getActor(formData);
  if (!actor) {
    return { ok: false, message: unauthorizedActionMessage() };
  }
  const { workOrder, invoice, workOrderId, invoiceId } =
    await getInvoiceContext(formData);

  if (!workOrder || !invoice) {
    return { ok: false, message: "Invoice could not be found for this work order." };
  }

  if (!canIssueInvoice(actor.role, workOrder, invoice)) {
    return { ok: false, message: "You cannot issue this invoice." };
  }

  await issueInvoice(workOrderId, invoiceId, actor);
  revalidateWorkOrder(workOrderId);
  redirect(`/work-orders/${workOrderId}?role=${actor.role}`);
}

export async function markInvoicePaidAction(
  _previousState: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const actor = await getActor(formData);
  if (!actor) {
    return { ok: false, message: unauthorizedActionMessage() };
  }
  const { workOrder, invoice, workOrderId, invoiceId } =
    await getInvoiceContext(formData);

  if (!workOrder || !invoice) {
    return { ok: false, message: "Invoice could not be found for this work order." };
  }

  if (!canMarkInvoicePaid(actor.role, workOrder, invoice)) {
    return { ok: false, message: "You cannot mark this invoice paid." };
  }

  await markInvoicePaid(
    workOrderId,
    invoiceId,
    readNullableString(formData, "paymentReference"),
    actor,
  );
  revalidateWorkOrder(workOrderId);
  redirect(`/work-orders/${workOrderId}?role=${actor.role}`);
}

export async function markInvoiceOverdueAction(
  _previousState: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const actor = await getActor(formData);
  if (!actor) {
    return { ok: false, message: unauthorizedActionMessage() };
  }
  const { workOrder, invoice, workOrderId, invoiceId } =
    await getInvoiceContext(formData);

  if (!workOrder || !invoice) {
    return { ok: false, message: "Invoice could not be found for this work order." };
  }

  if (!canMarkInvoiceOverdue(actor.role, workOrder, invoice)) {
    return { ok: false, message: "You cannot mark this invoice overdue." };
  }

  await markInvoiceOverdue(workOrderId, invoiceId, actor);
  revalidateWorkOrder(workOrderId);
  redirect(`/work-orders/${workOrderId}?role=${actor.role}`);
}

export async function voidInvoiceAction(
  _previousState: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const actor = await getActor(formData);
  if (!actor) {
    return { ok: false, message: unauthorizedActionMessage() };
  }
  const { workOrder, invoice, workOrderId, invoiceId } =
    await getInvoiceContext(formData);

  if (!workOrder || !invoice) {
    return { ok: false, message: "Invoice could not be found for this work order." };
  }

  if (!canVoidInvoice(actor.role, workOrder, invoice)) {
    return { ok: false, message: "You cannot void this invoice." };
  }

  await voidInvoice(workOrderId, invoiceId, actor);
  revalidateWorkOrder(workOrderId);
  redirect(`/work-orders/${workOrderId}?role=${actor.role}`);
}

export async function closePaidWorkOrderAction(
  _previousState: InvoiceActionState,
  formData: FormData,
): Promise<InvoiceActionState> {
  const actor = await getActor(formData);
  if (!actor) {
    return { ok: false, message: unauthorizedActionMessage() };
  }
  const workOrderId = readString(formData, "workOrderId");
  const [workOrder, currentInvoice] = await Promise.all([
    getWorkOrderById(workOrderId),
    getCurrentInvoiceForWorkOrder(workOrderId),
  ]);

  if (!workOrder) {
    return { ok: false, message: "Work order could not be found." };
  }

  if (!canClosePaidWorkOrder(actor.role, workOrder, currentInvoice)) {
    return {
      ok: false,
      message: "This work order cannot be closed until the current invoice is paid.",
    };
  }

  await closePaidWorkOrder(workOrderId, actor);
  revalidateWorkOrder(workOrderId);
  redirect(`/work-orders/${workOrderId}?role=${actor.role}`);
}

async function getInvoiceContext(formData: FormData) {
  const workOrderId = readString(formData, "workOrderId");
  const invoiceId = readString(formData, "invoiceId");
  const [workOrder, invoice] = await Promise.all([
    getWorkOrderById(workOrderId),
    getInvoiceById(workOrderId, invoiceId),
  ]);

  return { workOrder, invoice, workOrderId, invoiceId };
}

async function getActor(formData: FormData) {
  return resolveActionActor(readString(formData, "actorRole"));
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
