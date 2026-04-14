import type {
  PhaseOneCreateWorkOrderInput,
  PhaseOneUpdateWorkOrderInput,
} from "../../types/work-order.ts";
import { getClientById } from "@/lib/clients/repository";
import { getLocationById } from "@/lib/locations/repository";
import { parseWorkOrderPriority } from "../work-orders/constants.ts";

export type WorkOrderFormErrors = Partial<
  Record<
    keyof PhaseOneCreateWorkOrderInput | keyof PhaseOneUpdateWorkOrderInput | "form",
    string
  >
>;

export interface WorkOrderValidationResult<T> {
  ok: boolean;
  data?: T;
  errors: WorkOrderFormErrors;
}

const requiredStringFields = [
  "title",
  "description",
  "clientId",
  "locationId",
] as const satisfies readonly (keyof PhaseOneCreateWorkOrderInput)[];

const optionalStringFields = [
  "assignedCoordinatorName",
  "assignedManagerName",
  "category",
  "internalNotes",
  "completionNotes",
] as const;

export async function validateCreateWorkOrderForm(
  formData: FormData,
): Promise<WorkOrderValidationResult<PhaseOneCreateWorkOrderInput>> {
  const base = await validateCommonWorkOrderFields(formData, true);

  if (!base.ok || !base.data) {
    return base as WorkOrderValidationResult<PhaseOneCreateWorkOrderInput>;
  }

  return {
    ok: true,
    data: {
      title: base.data.title ?? "",
      description: base.data.description ?? "",
      clientId: base.data.clientId ?? "",
      locationId: base.data.locationId ?? "",
      priority: base.data.priority ?? "medium",
      requestedServiceDate: base.data.requestedServiceDate ?? null,
      assignedCoordinatorName: base.data.assignedCoordinatorName ?? null,
      assignedManagerName: base.data.assignedManagerName ?? null,
      category: base.data.category ?? null,
      internalNotes: base.data.internalNotes ?? null,
    },
    errors: {},
  };
}

export async function validateUpdateWorkOrderForm(
  formData: FormData,
): Promise<WorkOrderValidationResult<PhaseOneUpdateWorkOrderInput>> {
  return validateCommonWorkOrderFields(formData, true);
}

async function validateCommonWorkOrderFields(
  formData: FormData,
  requireRequiredFields: boolean,
): Promise<WorkOrderValidationResult<PhaseOneUpdateWorkOrderInput>> {
  const errors: WorkOrderFormErrors = {};
  const data: PhaseOneUpdateWorkOrderInput = {};

  for (const field of requiredStringFields) {
    const value = readTrimmedString(formData, field);

    if (requireRequiredFields && !value) {
      errors[field] = friendlyFieldName(field) + " is required.";
      continue;
    }

    if (value) {
      data[field] = value;
    }
  }

  for (const field of optionalStringFields) {
    const value = readTrimmedString(formData, field);
    data[field] = value || null;
  }

  const priority = parseWorkOrderPriority(formData.get("priority"));
  if (!priority) {
    errors.priority = "Priority is required.";
  } else {
    data.priority = priority;
  }

  const requestedServiceDate = readTrimmedString(formData, "requestedServiceDate");
  if (requestedServiceDate && Number.isNaN(Date.parse(requestedServiceDate))) {
    errors.requestedServiceDate = "Requested service date must be a valid date.";
  } else {
    data.requestedServiceDate = requestedServiceDate || null;
  }

  if (data.clientId && data.locationId) {
    const [client, location] = await Promise.all([
      getClientById(data.clientId),
      getLocationById(data.locationId),
    ]);

    if (!client) {
      errors.clientId = "Select an existing client.";
    }

    if (!location) {
      errors.locationId = "Select an existing location.";
    } else if (location.clientId !== data.clientId) {
      errors.locationId = "Select a location that belongs to the selected client.";
    }
  }

  return {
    ok: Object.keys(errors).length === 0,
    data,
    errors,
  };
}

function readTrimmedString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function friendlyFieldName(field: string): string {
  return field
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (letter) => letter.toUpperCase());
}
