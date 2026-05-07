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
import { CONTACT_RELATIONSHIP_TYPE_VALUES } from "@/types/contact";
import type { LocationQueryFilters, LocationStatus } from "@/types/location";
import { ValidationError } from "@/lib/utils/errors";

const LOCATION_STATUSES = ["active", "inactive"] as const;
const RECORD_STATUSES = ["active", "archived"] as const;

const createLocationAllowedFields = [
  "clientOrganizationId",
  "name",
  "displayName",
  "code",
  "storeNumber",
  "status",
  "primaryContactId",
  "siteContactId",
  "linkedContacts",
  "addressLine1",
  "addressLine2",
  "city",
  "region",
  "postalCode",
  "countryCode",
  "latitude",
  "longitude",
  "timeZone",
  "accessNotes",
  "serviceNotes",
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
    displayName: parseOptionalCreateString(payload.displayName, "displayName"),
    code: parseOptionalCreateString(payload.code, "code"),
    storeNumber: parseOptionalCreateString(payload.storeNumber, "storeNumber"),
    status: parseOptionalLocationStatus(payload.status),
    primaryContactId: parseOptionalEntityId(
      payload.primaryContactId,
      "primaryContactId",
    ),
    siteContactId: parseOptionalEntityId(payload.siteContactId, "siteContactId"),
    linkedContacts: parseOptionalContactLinks(payload.linkedContacts, "linkedContacts"),
    addressLine1: parseOptionalCreateString(payload.addressLine1, "addressLine1"),
    addressLine2: parseOptionalCreateString(payload.addressLine2, "addressLine2"),
    city: parseOptionalCreateString(payload.city, "city"),
    region: parseOptionalCreateString(payload.region, "region"),
    postalCode: parseOptionalCreatePostalCode(payload.postalCode, "postalCode"),
    countryCode: parseOptionalCreateCountryCode(
      payload.countryCode,
      "countryCode",
    ),
    latitude: parseOptionalCreateLatitude(payload.latitude, "latitude"),
    longitude: parseOptionalCreateLongitude(payload.longitude, "longitude"),
    timeZone: parseOptionalCreateTimeZone(payload.timeZone, "timeZone"),
    accessNotes: parseOptionalCreateString(payload.accessNotes, "accessNotes"),
    serviceNotes: parseOptionalCreateString(payload.serviceNotes, "serviceNotes"),
    notes: parseOptionalCreateString(payload.notes, "notes"),
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
    displayName: parseOptionalNullString(payload.displayName, "displayName"),
    code: parseOptionalNullString(payload.code, "code"),
    storeNumber: parseOptionalNullString(payload.storeNumber, "storeNumber"),
    status: parseOptionalLocationStatus(payload.status),
    primaryContactId: parseOptionalNullableEntityId(
      payload.primaryContactId,
      "primaryContactId",
    ),
    siteContactId: parseOptionalNullableEntityId(
      payload.siteContactId,
      "siteContactId",
    ),
    linkedContacts: parseOptionalContactLinks(payload.linkedContacts, "linkedContacts"),
    addressLine1: parseOptionalNullString(payload.addressLine1, "addressLine1"),
    addressLine2: parseOptionalNullString(payload.addressLine2, "addressLine2"),
    city: parseOptionalNullString(payload.city, "city"),
    region: parseOptionalNullString(payload.region, "region"),
    postalCode: parseOptionalNullablePostalCode(payload.postalCode, "postalCode"),
    countryCode: parseOptionalNullableCountryCode(
      payload.countryCode,
      "countryCode",
    ),
    latitude: parseOptionalNullableLatitude(payload.latitude, "latitude"),
    longitude: parseOptionalNullableLongitude(payload.longitude, "longitude"),
    timeZone: parseOptionalNullableTimeZone(payload.timeZone, "timeZone"),
    accessNotes: parseOptionalNullString(payload.accessNotes, "accessNotes"),
    serviceNotes: parseOptionalNullString(payload.serviceNotes, "serviceNotes"),
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

function parseOptionalCreateString(
  value: unknown,
  fieldName: string,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string.`);
  }

  return readOptionalString(value);
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

function parseOptionalCreateEmail(
  value: unknown,
  fieldName: string,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return parseOptionalEmail(value, fieldName);
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

function parseOptionalCreatePhone(
  value: unknown,
  fieldName: string,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  return parseOptionalPhone(value, fieldName);
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

function parseOptionalCreatePostalCode(
  value: unknown,
  fieldName: string,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(`${fieldName} must be a non-empty string.`);
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

function parseOptionalCreateCountryCode(
  value: unknown,
  fieldName: string,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string.`);
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }

  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new ValidationError(
      `${fieldName} must be a 2-letter ISO country code.`,
    );
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

function parseOptionalCoordinate(
  value: unknown,
  fieldName: string,
  minimum: number,
  maximum: number,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(`${fieldName} must be a valid number.`);
  }

  if (value < minimum || value > maximum) {
    throw new ValidationError(
      `${fieldName} must be between ${minimum} and ${maximum}.`,
    );
  }

  return value;
}

function parseOptionalCreateLatitude(
  value: unknown,
  fieldName: string,
): number | undefined {
  if (value === null) {
    return undefined;
  }

  return parseOptionalCoordinate(value, fieldName, -90, 90);
}

function parseOptionalNullableLatitude(
  value: unknown,
  fieldName: string,
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return parseOptionalCoordinate(value, fieldName, -90, 90);
}

function parseOptionalCreateLongitude(
  value: unknown,
  fieldName: string,
): number | undefined {
  if (value === null) {
    return undefined;
  }

  return parseOptionalCoordinate(value, fieldName, -180, 180);
}

function parseOptionalNullableLongitude(
  value: unknown,
  fieldName: string,
): number | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return parseOptionalCoordinate(value, fieldName, -180, 180);
}

function parseOptionalTimeZone(
  value: unknown,
  fieldName: string,
): string | undefined {
  const normalized = parseOptionalCreateString(value, fieldName);
  if (!normalized) {
    return undefined;
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: normalized });
  } catch {
    throw new ValidationError(`${fieldName} must be a valid IANA time zone.`);
  }

  return normalized;
}

function parseOptionalCreateTimeZone(
  value: unknown,
  fieldName: string,
): string | undefined {
  if (value === null) {
    return undefined;
  }

  return parseOptionalTimeZone(value, fieldName);
}

function parseOptionalNullableTimeZone(
  value: unknown,
  fieldName: string,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  return parseOptionalTimeZone(value, fieldName) ?? null;
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
