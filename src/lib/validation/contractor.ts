import type {
  ContractorStatus,
  CreateContractorInput,
} from "../../types/contractor.ts";

export type ContractorFormErrors = Partial<
  Record<keyof CreateContractorInput | "form", string>
>;

export type ContractorFormValidationResult =
  | { ok: true; data: CreateContractorInput; errors?: never }
  | { ok: false; data?: never; errors: ContractorFormErrors };

export function validateContractorForm(
  formData: FormData,
): ContractorFormValidationResult {
  const errors: ContractorFormErrors = {};
  const data: CreateContractorInput = {
    companyName: readRequired(formData, "companyName", "Company name", errors),
    contactName: readRequired(formData, "contactName", "Contact name", errors),
    email: readEmail(formData, "email", "Email", errors),
    phone: readRequired(formData, "phone", "Phone", errors),
    status: readStatus(formData, "status"),
    serviceCategories: readServiceCategories(formData),
    notes: readNullableString(formData, "notes"),
  };

  return Object.keys(errors).length === 0
    ? { ok: true, data }
    : { ok: false, errors };
}

function readRequired(
  formData: FormData,
  field: keyof CreateContractorInput,
  label: string,
  errors: ContractorFormErrors,
): string {
  const value = readTrimmedString(formData, field);
  if (!value) {
    errors[field] = `${label} is required.`;
  }

  return value;
}

function readEmail(
  formData: FormData,
  field: keyof CreateContractorInput,
  label: string,
  errors: ContractorFormErrors,
): string {
  const value = readRequired(formData, field, label, errors);
  if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    errors[field] = `${label} must be a valid email.`;
  }

  return value;
}

function readStatus(formData: FormData, field: string): ContractorStatus {
  return formData.get(field) === "inactive" ? "inactive" : "active";
}

function readServiceCategories(formData: FormData): string[] {
  return readTrimmedString(formData, "serviceCategories")
    .split(",")
    .map((category) => category.trim())
    .filter(Boolean)
    .filter((category, index, categories) => categories.indexOf(category) === index);
}

function readNullableString(formData: FormData, field: string): string | null {
  return readTrimmedString(formData, field) || null;
}

function readTrimmedString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}
