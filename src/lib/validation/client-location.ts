import type {
  CreateClientOrganizationInput,
  CreateLocationInput,
  OperationalRecordStatus,
} from "@/types/client";
import { getClientById } from "@/lib/clients/repository";

export type ClientFormErrors = Partial<
  Record<keyof CreateClientOrganizationInput | "form", string>
>;

export type LocationFormErrors = Partial<
  Record<keyof CreateLocationInput | "form", string>
>;

export interface ValidationResult<T, TErrors> {
  ok: boolean;
  data?: T;
  errors: TErrors;
}

export function validateClientForm(
  formData: FormData,
): ValidationResult<
  CreateClientOrganizationInput,
  ClientFormErrors
> {
  const errors: ClientFormErrors = {};
  const data: CreateClientOrganizationInput = {
    name: readRequired(formData, "name", "Client name", errors),
    status: readStatus(formData, "status"),
    primaryContactName: readRequired(
      formData,
      "primaryContactName",
      "Primary contact name",
      errors,
    ),
    primaryContactEmail: readOptionalEmail(
      formData,
      "primaryContactEmail",
      "Primary contact email",
      errors,
    ),
    primaryContactPhone: readRequired(
      formData,
      "primaryContactPhone",
      "Primary contact phone",
      errors,
    ),
    notes: readNullableString(formData, "notes"),
  };

  return {
    ok: Object.keys(errors).length === 0,
    data,
    errors,
  };
}

export async function validateLocationForm(
  formData: FormData,
): Promise<
  ValidationResult<CreateLocationInput, LocationFormErrors>
> {
  const errors: LocationFormErrors = {};
  const clientId = readRequired(formData, "clientId", "Client", errors);

  if (clientId && !(await getClientById(clientId))) {
    errors.clientId = "Select an existing client.";
  }

  const data: CreateLocationInput = {
    clientId,
    name: readRequired(formData, "name", "Location name", errors),
    addressLine1: readRequired(formData, "addressLine1", "Address line 1", errors),
    addressLine2: readNullableString(formData, "addressLine2"),
    city: readRequired(formData, "city", "City", errors),
    provinceOrState: readRequired(
      formData,
      "provinceOrState",
      "Province/state",
      errors,
    ),
    postalCode: readRequired(formData, "postalCode", "Postal code", errors),
    country: readRequired(formData, "country", "Country", errors),
    locationContactName: readRequired(
      formData,
      "locationContactName",
      "Location contact name",
      errors,
    ),
    locationContactEmail: readOptionalEmail(
      formData,
      "locationContactEmail",
      "Location contact email",
      errors,
    ),
    locationContactPhone: readRequired(
      formData,
      "locationContactPhone",
      "Location contact phone",
      errors,
    ),
    accessNotes: readNullableString(formData, "accessNotes"),
    status: readStatus(formData, "status"),
  };

  return {
    ok: Object.keys(errors).length === 0,
    data,
    errors,
  };
}

function readRequired<TErrors extends Record<string, string | undefined>>(
  formData: FormData,
  field: string,
  label: string,
  errors: TErrors,
): string {
  const value = readTrimmedString(formData, field);
  if (!value) {
    errors[field as keyof TErrors] = `${label} is required.` as TErrors[keyof TErrors];
  }

  return value;
}

function readNullableString(formData: FormData, field: string): string | null {
  return readTrimmedString(formData, field) || null;
}

function readOptionalEmail<TErrors extends Record<string, string | undefined>>(
  formData: FormData,
  field: string,
  label: string,
  errors: TErrors,
): string | null {
  const value = readTrimmedString(formData, field);
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    errors[field as keyof TErrors] = `${label} must be a valid email.` as TErrors[keyof TErrors];
  }

  return value || null;
}

function readStatus(formData: FormData, field: string): OperationalRecordStatus {
  return formData.get(field) === "inactive" ? "inactive" : "active";
}

function readTrimmedString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}
