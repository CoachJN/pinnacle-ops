"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canCreateWorkOrder,
  canEditWorkOrder,
  canTransitionWorkOrder,
  getDeniedTransitionMessage,
} from "@/lib/permissions/work-order-permissions";
import {
  resolveActionActor,
  unauthorizedActionMessage,
} from "@/lib/permissions/resolve-action-actor";
import {
  createWorkOrder,
  getWorkOrderById,
  transitionWorkOrderStatus,
  updateWorkOrder,
} from "./repository";
import { getCurrentQuoteForWorkOrder } from "@/lib/quotes/repository";
import { parseWorkOrderStatus } from "./status";
import {
  validateCreateWorkOrderForm,
  validateUpdateWorkOrderForm,
  type WorkOrderFormErrors,
} from "@/lib/validation/work-order";

export interface WorkOrderFormState {
  ok: boolean;
  message?: string;
  errors?: WorkOrderFormErrors;
}

export async function createWorkOrderAction(
  _previousState: WorkOrderFormState,
  formData: FormData,
): Promise<WorkOrderFormState> {
  const actor = await resolveActionActor(readString(formData, "actorRole"));
  if (!actor) {
    return {
      ok: false,
      message: unauthorizedActionMessage(),
    };
  }

  if (!canCreateWorkOrder(actor.role)) {
    return {
      ok: false,
      message: "You do not have permission to create work orders.",
    };
  }

  const validation = await validateCreateWorkOrderForm(formData);
  if (!validation.ok || !validation.data) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      errors: validation.errors,
    };
  }

  const workOrder = await createWorkOrder(validation.data, actor);
  revalidatePath("/work-orders");
  redirect(`/work-orders/${workOrder.id}?role=${actor.role}`);
}

export async function updateWorkOrderAction(
  _previousState: WorkOrderFormState,
  formData: FormData,
): Promise<WorkOrderFormState> {
  const actor = await resolveActionActor(readString(formData, "actorRole"));
  if (!actor) {
    return {
      ok: false,
      message: unauthorizedActionMessage(),
    };
  }

  const id = readString(formData, "id");
  const workOrder = await getWorkOrderById(id);

  if (!workOrder) {
    return {
      ok: false,
      message: "Work order could not be found.",
      errors: { form: "Work order could not be found." },
    };
  }

  if (!canEditWorkOrder(actor.role, workOrder)) {
    return {
      ok: false,
      message: "This work order is read-only for your role.",
      errors: { form: "This work order is read-only for your role." },
    };
  }

  const validation = await validateUpdateWorkOrderForm(formData);
  if (!validation.ok || !validation.data) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      errors: validation.errors,
    };
  }

  await updateWorkOrder(id, validation.data, actor);
  revalidatePath("/work-orders");
  revalidatePath(`/work-orders/${id}`);
  redirect(`/work-orders/${id}?role=${actor.role}`);
}

export async function transitionWorkOrderAction(
  _previousState: WorkOrderFormState,
  formData: FormData,
): Promise<WorkOrderFormState> {
  const actor = await resolveActionActor(readString(formData, "actorRole"));
  if (!actor) {
    return {
      ok: false,
      message: unauthorizedActionMessage(),
    };
  }

  const id = readString(formData, "id");
  const nextStatus = parseWorkOrderStatus(formData.get("nextStatus"));
  const workOrder = await getWorkOrderById(id);

  if (!workOrder) {
    return {
      ok: false,
      message: "Work order could not be found.",
    };
  }

  if (!nextStatus) {
    return {
      ok: false,
      message: "Requested status is invalid.",
    };
  }

  const currentQuote = await getCurrentQuoteForWorkOrder(workOrder.id);

  if (
    !canTransitionWorkOrder(actor.role, workOrder, nextStatus, {
      currentQuoteStatus: currentQuote?.status ?? null,
    })
  ) {
    return {
      ok: false,
      message: getDeniedTransitionMessage(actor.role, workOrder.status, nextStatus),
    };
  }

  await transitionWorkOrderStatus(id, nextStatus, actor);
  revalidatePath("/work-orders");
  revalidatePath(`/work-orders/${id}`);
  redirect(`/work-orders/${id}?role=${actor.role}`);
}

function readString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}
