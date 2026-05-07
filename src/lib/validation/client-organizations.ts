import {
  isEmail,
  requirePlainObject,
  requireString,
  readOptionalEmail,
  readOptionalString,
  type UnknownRecord,
} from "@/lib/validation/common";
import { CONTACT_RELATIONSHIP_TYPE_VALUES } from "@/types/contact";
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
  "primaryContactId",
  "billingContactId",
  "linkedContacts",
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
      primaryContactId: parseOptionalEntityId(
        payload.primaryContactId,
        "primaryContactId",
      ),
      billingContactId: parseOptionalEntityId(
        payload.billingContactId,
        "billingContactId",
      ),
      linkedContacts: parseOptionalContactLinks(payload.linkedContacts, "linkedContacts"),
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
      primaryContactId: parseOptionalNullableEntityId(
        payload.primaryContactId,
        "primaryContactId",
      ),
      billingContactId: parseOptionalNullableEntityId(
        payload.billingContactId,
        "billingContactId",
      ),
      linkedContacts: parseOptionalContactLinks(payload.linkedContacts, "linkedContacts"),
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

function parseOptionalEntityId(
  value: unknown,
  fieldName: string,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return requireString(value, fieldName);
}

function parseOptionalNullableEntityId(
  value: unknown,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return requireString(value, fieldName);
}

function parseOptionalContactLinks(
  value: unknown,
  fieldName: string,
):
  | Array<{
      contactId: string;
      relationshipType: (typeof CONTACT_RELATIONSHIP_TYPE_VALUES)[number];
      notes?: string | null;
    }>
  | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} must be an array.`);
  }

  return value.map((item, index) => parseContactLink(item, `${fieldName}[${index}]`));
}

function parseContactLink(
  value: unknown,
  fieldName: string,
): {
  contactId: string;
  relationshipType: (typeof CONTACT_RELATIONSHIP_TYPE_VALUES)[number];
  notes?: string | null;
} {
  const payload = requirePlainObject(value, `${fieldName} must be a plain object.`);
  assertNoUnknownFields(
    payload,
    ["contactId", "relationshipType", "notes"],
    fieldName,
  );

  const relationshipType = requireString(
    payload.relationshipType,
    `${fieldName}.relationshipType`,
  ) as (typeof CONTACT_RELATIONSHIP_TYPE_VALUES)[number];

  if (!CONTACT_RELATIONSHIP_TYPE_VALUES.includes(relationshipType)) {
    throw new ValidationError(`${fieldName}.relationshipType is invalid.`);
  }

  return pruneUndefined({
    contactId: requireString(payload.contactId, `${fieldName}.contactId`),
    relationshipType,
    notes: parseOptionalNullString(payload.notes, `${fieldName}.notes`),
  });
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
