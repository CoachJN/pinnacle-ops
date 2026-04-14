"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  resolveActionActor,
  unauthorizedActionMessage,
} from "@/lib/permissions/resolve-action-actor";
import { canCreateClient, canEditClient } from "@/lib/permissions/client-permissions";
import {
  createClient,
  getClientById,
  updateClient,
} from "@/lib/clients/repository";
import {
  validateClientForm,
  type ClientFormErrors,
} from "@/lib/validation/client-location";

export interface ClientFormState {
  ok: boolean;
  message?: string;
  errors?: ClientFormErrors;
}

export async function createClientAction(
  _previousState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const actor = await resolveActionActor(readString(formData, "actorRole"));
  if (!actor) {
    return {
      ok: false,
      message: unauthorizedActionMessage(),
    };
  }

  if (!canCreateClient(actor.role)) {
    return {
      ok: false,
      message: "You do not have permission to create clients.",
    };
  }

  const validation = validateClientForm(formData);
  if (!validation.ok || !validation.data) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      errors: validation.errors,
    };
  }

  const client = await createClient(validation.data, actor);
  revalidatePath("/clients");
  redirect(`/clients/${client.id}?role=${actor.role}`);
}

export async function updateClientAction(
  _previousState: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const actor = await resolveActionActor(readString(formData, "actorRole"));
  if (!actor) {
    return {
      ok: false,
      message: unauthorizedActionMessage(),
    };
  }

  const id = readString(formData, "id");
  const client = await getClientById(id);

  if (!client) {
    return {
      ok: false,
      message: "Client could not be found.",
      errors: { form: "Client could not be found." },
    };
  }

  if (!canEditClient(actor.role, client)) {
    return {
      ok: false,
      message: "You do not have permission to edit clients.",
      errors: { form: "You do not have permission to edit clients." },
    };
  }

  const validation = validateClientForm(formData);
  if (!validation.ok || !validation.data) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      errors: validation.errors,
    };
  }

  await updateClient(id, validation.data, actor);
  revalidatePath("/clients");
  revalidatePath(`/clients/${id}`);
  redirect(`/clients/${id}?role=${actor.role}`);
}

function readString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}
