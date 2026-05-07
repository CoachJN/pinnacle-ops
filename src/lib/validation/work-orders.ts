import {
  requirePlainObject,
  requireString,
  readOptionalString,
} from "@/lib/validation/common";
import {
  assertNoUnknownFields,
  createValidationSchema,
  type InferSchemaInput,
  type InferSchemaOutput,
} from "@/lib/utils/domain-validation";
import { ValidationError } from "@/lib/utils/errors";
import type { WorkOrderPriority } from "@/types/work-order";

const WORK_ORDER_PRIORITIES = ["low", "medium", "high", "urgent"] as const;

const createWorkOrderAllowedFields = [
  "title",
  "description",
  "priority",
  "clientOrganizationId",
  "locationId",
  "requestedByContactId",
  "coordinatorUserId",
  "managerUserId",
  "category",
  "requestedServiceDate",
] as const;

const updateWorkOrderAllowedFields = [
  "title",
  "description",
  "priority",
  "clientOrganizationId",
  "locationId",
  "category",
  "requestedServiceDate",
] as const;

export const createWorkOrderSchema = createValidationSchema((value: unknown) => {
  const payload = requirePlainObject(
    value,
    "Work order payload must be a plain object.",
  );

  assertNoUnknownFields(payload, createWorkOrderAllowedFields, "Work order payload");

  return {
    title: requireString(payload.title, "title"),
    description: requireString(payload.description, "description"),
    priority: parsePriority(payload.priority),
    clientOrganizationId: requireString(
      payload.clientOrganizationId,
      "clientOrganizationId",
    ),
    locationId: requireString(payload.locationId, "locationId"),
    requestedByContactId: parseNullableString(
      payload.requestedByContactId,
      "requestedByContactId",
    ),
    coordinatorUserId: parseNullableString(
      payload.coordinatorUserId,
      "coordinatorUserId",
    ),
    managerUserId: parseNullableString(
      payload.managerUserId,
      "managerUserId",
    ),
    category: parseNullableString(payload.category, "category"),
    requestedServiceDate: parseNullableDateTime(
      payload.requestedServiceDate,
      "requestedServiceDate",
    ),
  };
});

export const updateWorkOrderSchema = createValidationSchema((value: unknown) => {
  const payload = requirePlainObject(
    value,
    "Work order payload must be a plain object.",
  );

  assertNoUnknownFields(payload, updateWorkOrderAllowedFields, "Work order payload");

  return pruneUndefined({
    title: parseOptionalRequiredString(payload.title, "title"),
    description: parseOptionalRequiredString(payload.description, "description"),
    priority:
      payload.priority === undefined ? undefined : parsePriority(payload.priority),
    clientOrganizationId: parseOptionalRequiredString(
      payload.clientOrganizationId,
      "clientOrganizationId",
    ),
    locationId: parseOptionalRequiredString(payload.locationId, "locationId"),
    category: parseOptionalNullString(payload.category, "category"),
    requestedServiceDate: parseOptionalNullableDateTime(
      payload.requestedServiceDate,
      "requestedServiceDate",
    ),
  });
});

export type CreateWorkOrderSchemaInput = InferSchemaInput<
  typeof createWorkOrderSchema
>;
export type CreateWorkOrderSchemaOutput = InferSchemaOutput<
  typeof createWorkOrderSchema
>;
export type UpdateWorkOrderSchemaInput = InferSchemaInput<
  typeof updateWorkOrderSchema
>;
export type UpdateWorkOrderSchemaOutput = InferSchemaOutput<
  typeof updateWorkOrderSchema
>;

function parsePriority(value: unknown): WorkOrderPriority {
  if (
    typeof value !== "string" ||
    !WORK_ORDER_PRIORITIES.includes(value as WorkOrderPriority)
  ) {
    throw new ValidationError("priority must be low, medium, high, or urgent.");
  }

  return value as WorkOrderPriority;
}

function parseOptionalRequiredString(
  value: unknown,
  fieldName: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return requireString(value, fieldName);
}

function parseNullableString(
  value: unknown,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return requireString(value, fieldName);
}

function parseOptionalNullString(
  value: unknown,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string or null.`);
  }

  return readOptionalString(value) ?? null;
}

function parseNullableDateTime(
  value: unknown,
  fieldName: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return parseDateTimeString(value, fieldName);
}

function parseOptionalNullableDateTime(
  value: unknown,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return parseDateTimeString(value, fieldName);
}

function parseDateTimeString(value: unknown, fieldName: string): string {
  const parsed = requireString(value, fieldName);

  if (Number.isNaN(Date.parse(parsed))) {
    throw new ValidationError(`${fieldName} must be a valid date string.`);
  }

  return parsed;
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined),
  ) as T;
}
