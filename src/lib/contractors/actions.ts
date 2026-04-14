"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  canAssignContractor,
  canCreateContractor,
  canEditContractor,
} from "../permissions/contractor-permissions.ts";
import {
  resolveActionActor,
  unauthorizedActionMessage,
} from "../permissions/resolve-action-actor.ts";
import {
  createContractor,
  getContractorById,
  updateContractor,
} from "./repository.ts";
import {
  validateContractorForm,
  type ContractorFormErrors,
} from "../validation/contractor.ts";
import {
  assignContractorToWorkOrder,
  getWorkOrderById,
} from "../work-orders/repository.ts";

export interface ContractorFormState {
  ok: boolean;
  message?: string;
  errors?: ContractorFormErrors;
}

export async function createContractorAction(
  _previousState: ContractorFormState,
  formData: FormData,
): Promise<ContractorFormState> {
  const actor = await resolveActionActor(readString(formData, "actorRole"));
  if (!actor) {
    return {
      ok: false,
      message: unauthorizedActionMessage(),
    };
  }

  if (!canCreateContractor(actor.role)) {
    return {
      ok: false,
      message: "You do not have permission to create contractors.",
    };
  }

  const validation = validateContractorForm(formData);
  if (!validation.ok) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      errors: validation.errors,
    };
  }

  const contractor = await createContractor(validation.data, actor);
  revalidatePath("/contractors");
  redirect(`/contractors/${contractor.id}?role=${actor.role}`);
}

export async function updateContractorAction(
  _previousState: ContractorFormState,
  formData: FormData,
): Promise<ContractorFormState> {
  const actor = await resolveActionActor(readString(formData, "actorRole"));
  if (!actor) {
    return {
      ok: false,
      message: unauthorizedActionMessage(),
    };
  }

  const id = readString(formData, "id");
  const contractor = await getContractorById(id);

  if (!contractor) {
    return {
      ok: false,
      message: "Contractor could not be found.",
      errors: { form: "Contractor could not be found." },
    };
  }

  if (!canEditContractor(actor.role, contractor)) {
    return {
      ok: false,
      message: "You do not have permission to edit contractors.",
      errors: { form: "You do not have permission to edit contractors." },
    };
  }

  const validation = validateContractorForm(formData);
  if (!validation.ok) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      errors: validation.errors,
    };
  }

  await updateContractor(id, validation.data, actor);
  revalidatePath("/contractors");
  revalidatePath(`/contractors/${id}`);
  redirect(`/contractors/${id}?role=${actor.role}`);
}

export async function assignContractorAction(formData: FormData) {
  const actor = await resolveActionActor(readString(formData, "actorRole"));
  if (!actor) {
    return;
  }

  const workOrderId = readString(formData, "workOrderId");
  const contractorId = readString(formData, "contractorId") || null;
  const workOrder = await getWorkOrderById(workOrderId);

  if (!workOrder || !canAssignContractor(actor.role, workOrder)) {
    return;
  }

  await assignContractorToWorkOrder(workOrderId, contractorId, actor);
  revalidatePath("/work-orders");
  revalidatePath(`/work-orders/${workOrderId}`);
  revalidatePath("/contractor/dashboard");
  revalidatePath("/contractor/work-orders");
  redirect(`/work-orders/${workOrderId}?role=${actor.role}`);
}

function readString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}
