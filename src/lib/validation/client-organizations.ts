import {
  isEmail,
  requirePlainObject,
  requireString,
  readOptionalEmail,
  readOptionalString,
  type UnknownRecord,
} from "@/lib/validation/common";
import {
  assertNoUnknownFields,
  createValidationSchema,
  type InferSchemaInput,
  type InferSchemaOutput,
} from "@/lib/utils/domain-validation";
import {
  isValidPhoneNumber,
  normalizeOptionalNullString,
  normalizePhoneNumber,
} from "@/lib/utils/normalization";
import type { ClientOrganizationStatus } from "@/types/client-organization";
import { ValidationError } from "@/lib/utils/errors";

const CLIENT_ORGANIZATION_STATUSES = ["active", "inactive"] as const;

const createClientOrganizationAllowedFields = [
  "name",
  "displayName",
  "status",
  "primaryContactName",
  "primaryContactEmail",
  "primaryContactPhone",
  "billingEmail",
  "notes",
] as const;

const updateClientOrganizationAllowedFields =
  createClientOrganizationAllowedFields;

export const createClientOrganizationSchema = createValidationSchema(
  (value: unknown) => {
    const payload = requirePlainObject(
      value,
      "Client organization payload must be a plain object.",
    );

    assertNoUnknownFields(
      payload,
      createClientOrganizationAllowedFields,
      "Client organization payload",
    );

    return {
      name: requireString(payload.name, "name"),
      displayName: readOptionalString(payload.displayName),
      status: parseOptionalClientOrganizationStatus(payload.status),
      primaryContactName: readOptionalString(payload.primaryContactName),
      primaryContactEmail: parseOptionalEmail(
        payload.primaryContactEmail,
        "primaryContactEmail",
      ),
      primaryContactPhone: parseOptionalPhone(
        payload.primaryContactPhone,
        "primaryContactPhone",
      ),
      billingEmail: parseOptionalEmail(payload.billingEmail, "billingEmail"),
      notes: readOptionalString(payload.notes),
    };
  },
);

export const updateClientOrganizationSchema = createValidationSchema(
  (value: unknown) => {
    const payload = requirePlainObject(
      value,
      "Client organization payload must be a plain object.",
    );

    assertNoUnknownFields(
      payload,
      updateClientOrganizationAllowedFields,
      "Client organization payload",
    );

    return pruneUndefined({
      name: parseOptionalRequiredString(payload.name, "name"),
      displayName: parseOptionalNullString(payload.displayName, "displayName"),
      status: parseOptionalClientOrganizationStatus(payload.status),
      primaryContactName: parseOptionalNullString(
        payload.primaryContactName,
        "primaryContactName",
      ),
      primaryContactEmail: parseOptionalNullableEmail(
        payload.primaryContactEmail,
        "primaryContactEmail",
      ),
      primaryContactPhone: parseOptionalNullablePhone(
        payload.primaryContactPhone,
        "primaryContactPhone",
      ),
      billingEmail: parseOptionalNullableEmail(
        payload.billingEmail,
        "billingEmail",
      ),
      notes: parseOptionalNullString(payload.notes, "notes"),
    });
  },
);

export type CreateClientOrganizationSchemaInput = InferSchemaInput<
  typeof createClientOrganizationSchema
>;
export type CreateClientOrganizationSchemaOutput = InferSchemaOutput<
  typeof createClientOrganizationSchema
>;
export type UpdateClientOrganizationSchemaInput = InferSchemaInput<
  typeof updateClientOrganizationSchema
>;
export type UpdateClientOrganizationSchemaOutput = InferSchemaOutput<
  typeof updateClientOrganizationSchema
>;

function parseOptionalClientOrganizationStatus(
  value: unknown,
): ClientOrganizationStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    !CLIENT_ORGANIZATION_STATUSES.includes(value as ClientOrganizationStatus)
  ) {
    throw new ValidationError("status must be active or inactive.");
  }

  return value as ClientOrganizationStatus;
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

  return normalizeOptionalNullString(value) ?? null;
}

function parseOptionalEmail(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a valid email address.`);
  }

  if (!value.trim()) {
    return undefined;
  }

  if (!isEmail(value)) {
    throw new ValidationError(`${fieldName} must be a valid email address.`);
  }

  return readOptionalEmail(value);
}

function parseOptionalNullableEmail(
  value: unknown,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return parseOptionalEmail(value, fieldName) ?? null;
}

function parseOptionalPhone(value: unknown, fieldName: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a valid phone number.`);
  }

  if (!value.trim()) {
    return undefined;
  }

  if (!isValidPhoneNumber(value)) {
    throw new ValidationError(`${fieldName} must be a valid phone number.`);
  }

  return normalizePhoneNumber(value);
}

function parseOptionalNullablePhone(
  value: unknown,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return parseOptionalPhone(value, fieldName) ?? null;
}

function pruneUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}
