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
  const legalName = readRequired(formData, "legalName", "Legal name", errors);
  const displayName = readTrimmedString(formData, "displayName");
  const parentContractorId = readNullableString(formData, "parentContractorId");
  const businessEmail = readEmail(formData, "businessEmail", "Business email", errors);
  const mainPhone = readRequired(formData, "mainPhone", "Main phone", errors);
  const altPhone = readNullableString(formData, "altPhone");
  const fax = readNullableString(formData, "fax");
  const primaryContactId = readNullableString(formData, "primaryContactId");
  const billingContactId = readNullableString(formData, "billingContactId");
  const dispatchContactId = readNullableString(formData, "dispatchContactId");
  const trades = readTrades(formData);
  if (trades.length === 0) {
    errors.trades = "At least one trade is required.";
  }

  const data: CreateContractorInput = {
    legalName,
    displayName: displayName || null,
    parentContractorId,
    businessEmail: businessEmail || null,
    mainPhone,
    altPhone,
    fax,
    primaryContactId,
    billingContactId,
    dispatchContactId,
    status: readStatus(formData, "status"),
    trades,
    serviceArea: readNullableString(formData, "serviceArea"),
    isAssignable: readBoolean(formData, "isAssignable"),
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
  const value = formData.get(field);
  return value === "inactive" ||
    value === "onboarding" ||
    value === "suspended"
    ? value
    : "active";
}

function readTrades(formData: FormData): CreateContractorInput["trades"] {
  const rawValues = formData
    .getAll("trades")
    .flatMap((value) =>
      typeof value === "string" ? value.split(",") : [],
    )
    .concat(readTrimmedString(formData, "trades"));

  return rawValues
    .map((trade) => trade.trim())
    .filter(Boolean)
    .filter((trade, index, trades) => trades.indexOf(trade) === index)
    .map(normalizeTradeValue)
    .filter((trade, index, trades) => trades.indexOf(trade) === index);
}

function readNullableString(formData: FormData, field: string): string | null {
  return readTrimmedString(formData, field) || null;
}

function readBoolean(formData: FormData, field: string): boolean {
  const value = formData.get(field);
  return value === "true" || value === "on" || value === "1";
}

function readTrimmedString(formData: FormData, field: string): string {
  const value = formData.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTradeValue(value: string): CreateContractorInput["trades"][number] {
  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");

  switch (normalized) {
    case "hvac":
    case "plumbing":
    case "electrical":
    case "mechanical":
    case "refrigeration":
    case "controls":
    case "access_control":
    case "doors":
    case "elevator":
    case "roofing":
    case "restoration":
    case "janitorial":
    case "landscaping":
    case "security":
    case "locksmith":
    case "painting":
    case "paving":
    case "waste":
    case "other":
      return normalized;
    case "general":
    case "general_maintenance":
    case "general_contracting":
      return "general_contracting";
    case "low_voltage":
    case "av":
      return "low_voltage";
    case "fire":
    case "fire_life_safety":
      return "fire_life_safety";
    case "snow":
    case "snow_removal":
      return "snow_removal";
    default:
      return "other";
  }
}
