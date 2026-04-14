"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  resolveActionActor,
  unauthorizedActionMessage,
} from "@/lib/permissions/resolve-action-actor";
import {
  canCreateLocation,
  canEditLocation,
} from "@/lib/permissions/location-permissions";
import {
  createLocation,
  getLocationById,
  updateLocation,
} from "@/lib/locations/repository";
import { countWorkOrdersForLocation } from "@/lib/work-orders/repository";
import {
  validateLocationForm,
  type LocationFormErrors,
} from "@/lib/validation/client-location";

export interface LocationFormState {
  ok: boolean;
  message?: string;
  errors?: LocationFormErrors;
}

export async function createLocationAction(
  _previousState: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  const actor = await resolveActionActor(readString(formData, "actorRole"));
  if (!actor) {
    return {
      ok: false,
      message: unauthorizedActionMessage(),
    };
  }

  if (!canCreateLocation(actor.role)) {
    return {
      ok: false,
      message: "You do not have permission to create locations.",
    };
  }

  const validation = await validateLocationForm(formData);
  if (!validation.ok || !validation.data) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      errors: validation.errors,
    };
  }

  const location = await createLocation(validation.data, actor);
  revalidatePath("/locations");
  revalidatePath(`/clients/${location.clientId}`);
  redirect(`/locations/${location.id}?role=${actor.role}`);
}

export async function updateLocationAction(
  _previousState: LocationFormState,
  formData: FormData,
): Promise<LocationFormState> {
  const actor = await resolveActionActor(readString(formData, "actorRole"));
  if (!actor) {
    return {
      ok: false,
      message: unauthorizedActionMessage(),
    };
  }

  const id = readString(formData, "id");
  const location = await getLocationById(id);

  if (!location) {
    return {
      ok: false,
      message: "Location could not be found.",
      errors: { form: "Location could not be found." },
    };
  }

  if (!canEditLocation(actor.role, location)) {
    return {
      ok: false,
      message: "You do not have permission to edit locations.",
      errors: { form: "You do not have permission to edit locations." },
    };
  }

  const validation = await validateLocationForm(formData);
  if (!validation.ok || !validation.data) {
    return {
      ok: false,
      message: "Please fix the highlighted fields.",
      errors: validation.errors,
    };
  }

  const workOrderCount = await countWorkOrdersForLocation(id);
  if (
    validation.data.clientId &&
    validation.data.clientId !== location.clientId &&
    workOrderCount > 0
  ) {
    return {
      ok: false,
      message: "This location already has work orders and cannot be reassigned.",
      errors: {
        clientId:
          "Client is locked because work orders already reference this location.",
      },
    };
  }

  await updateLocation(id, validation.data, actor);
  revalidatePath("/locations");
  revalidatePath(`/locations/${id}`);
  revalidatePath(`/clients/${location.clientId}`);
  revalidatePath(`/clients/${validation.data.clientId}`);
  redirect(`/locations/${id}?role=${actor.role}`);
}

function readString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value : "";
}
