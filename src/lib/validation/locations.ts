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
  normalizePostalCode,
} from "@/lib/utils/normalization";
import type { LocationQueryFilters, LocationStatus } from "@/types/location";
import { ValidationError } from "@/lib/utils/errors";

const LOCATION_STATUSES = ["active", "inactive"] as const;
const RECORD_STATUSES = ["active", "archived"] as const;

const createLocationAllowedFields = [
  "clientOrganizationId",
  "name",
  "code",
  "status",
  "addressLine1",
  "addressLine2",
  "city",
  "region",
  "postalCode",
  "countryCode",
  "locationContactName",
  "locationContactEmail",
  "locationContactPhone",
  "accessNotes",
  "notes",
] as const;

const updateLocationAllowedFields = createLocationAllowedFields;

const locationQueryFilterAllowedFields = [
  "clientOrganizationId",
  "status",
  "recordStatus",
  "search",
  "limit",
] as const;

export const createLocationSchema = createValidationSchema((value: unknown) => {
  const payload = requirePlainObject(value, "Location payload must be a plain object.");

  assertNoUnknownFields(payload, createLocationAllowedFields, "Location payload");

  return {
    clientOrganizationId: requireString(
      payload.clientOrganizationId,
      "clientOrganizationId",
    ),
    name: requireString(payload.name, "name"),
    code: readOptionalString(payload.code),
    status: parseOptionalLocationStatus(payload.status),
    addressLine1: readOptionalString(payload.addressLine1),
    addressLine2: readOptionalString(payload.addressLine2),
    city: readOptionalString(payload.city),
    region: readOptionalString(payload.region),
    postalCode: parseOptionalPostalCode(payload.postalCode),
    countryCode: parseOptionalCountryCode(payload.countryCode),
    locationContactName: readOptionalString(payload.locationContactName),
    locationContactEmail: parseOptionalEmail(
      payload.locationContactEmail,
      "locationContactEmail",
    ),
    locationContactPhone: parseOptionalPhone(
      payload.locationContactPhone,
      "locationContactPhone",
    ),
    accessNotes: readOptionalString(payload.accessNotes),
    notes: readOptionalString(payload.notes),
  };
});

export const updateLocationSchema = createValidationSchema((value: unknown) => {
  const payload = requirePlainObject(value, "Location payload must be a plain object.");

  assertNoUnknownFields(payload, updateLocationAllowedFields, "Location payload");

  return pruneUndefined({
    clientOrganizationId: parseOptionalRequiredString(
      payload.clientOrganizationId,
      "clientOrganizationId",
    ),
    name: parseOptionalRequiredString(payload.name, "name"),
    code: parseOptionalNullString(payload.code, "code"),
    status: parseOptionalLocationStatus(payload.status),
    addressLine1: parseOptionalNullString(payload.addressLine1, "addressLine1"),
    addressLine2: parseOptionalNullString(payload.addressLine2, "addressLine2"),
    city: parseOptionalNullString(payload.city, "city"),
    region: parseOptionalNullString(payload.region, "region"),
    postalCode: parseOptionalNullablePostalCode(payload.postalCode, "postalCode"),
    countryCode: parseOptionalNullableCountryCode(
      payload.countryCode,
      "countryCode",
    ),
    locationContactName: parseOptionalNullString(
      payload.locationContactName,
      "locationContactName",
    ),
    locationContactEmail: parseOptionalNullableEmail(
      payload.locationContactEmail,
      "locationContactEmail",
    ),
    locationContactPhone: parseOptionalNullablePhone(
      payload.locationContactPhone,
      "locationContactPhone",
    ),
    accessNotes: parseOptionalNullString(payload.accessNotes, "accessNotes"),
    notes: parseOptionalNullString(payload.notes, "notes"),
  });
});

export const locationQueryFiltersSchema = createValidationSchema((value: unknown) => {
  const payload = requirePlainObject(
    value,
    "Location query filters must be a plain object.",
  );

  assertNoUnknownFields(
    payload,
    locationQueryFilterAllowedFields,
    "Location query filters",
  );

  return pruneUndefined<LocationQueryFilters>({
    clientOrganizationId: parseOptionalRequiredString(
      payload.clientOrganizationId,
      "clientOrganizationId",
    ),
    status: parseOptionalLocationStatus(payload.status),
    recordStatus: parseOptionalRecordStatus(payload.recordStatus),
    search: parseOptionalRequiredString(payload.search, "search"),
    limit: parseOptionalLimit(payload.limit),
  });
});

export type CreateLocationSchemaInput = InferSchemaInput<typeof createLocationSchema>;
export type CreateLocationSchemaOutput = InferSchemaOutput<
  typeof createLocationSchema
>;
export type UpdateLocationSchemaInput = InferSchemaInput<typeof updateLocationSchema>;
export type UpdateLocationSchemaOutput = InferSchemaOutput<
  typeof updateLocationSchema
>;
export type LocationQueryFiltersSchemaInput = InferSchemaInput<
  typeof locationQueryFiltersSchema
>;
export type LocationQueryFiltersSchemaOutput = InferSchemaOutput<
  typeof locationQueryFiltersSchema
>;

function parseOptionalLocationStatus(value: unknown): LocationStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    !LOCATION_STATUSES.includes(value as LocationStatus)
  ) {
    throw new ValidationError("status must be active or inactive.");
  }

  return value as LocationStatus;
}

function parseOptionalRecordStatus(
  value: unknown,
): LocationQueryFilters["recordStatus"] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (
    typeof value !== "string" ||
    !RECORD_STATUSES.includes(value as NonNullable<LocationQueryFilters["recordStatus"]>)
  ) {
    throw new ValidationError("recordStatus must be active or archived.");
  }

  return value as NonNullable<LocationQueryFilters["recordStatus"]>;
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

function parseOptionalPostalCode(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError("postalCode must be a non-empty string.");
  }

  return normalizePostalCode(value);
}

function parseOptionalNullablePostalCode(
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
    throw new ValidationError(`${fieldName} must be a non-empty string or null.`);
  }

  if (!value.trim()) {
    return null;
  }

  return normalizePostalCode(value);
}

function parseOptionalCountryCode(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ValidationError("countryCode must be a string.");
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }

  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new ValidationError("countryCode must be a 2-letter ISO country code.");
  }

  return normalized;
}

function parseOptionalNullableCountryCode(
  value: unknown,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  const normalized = parseOptionalCountryCode(value);
  if (!normalized) {
    return null;
  }

  return normalized;
}

function parseOptionalLimit(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 100) {
    throw new ValidationError("limit must be an integer between 1 and 100.");
  }

  return value;
}

function pruneUndefined<T extends object>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entryValue]) => entryValue !== undefined),
  ) as T;
}
