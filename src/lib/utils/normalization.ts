const PHONE_DIGIT_PATTERN = /^\d{10,15}$/;
const CANADIAN_POSTAL_CODE_PATTERN = /^[A-Z]\d[A-Z]\d[A-Z]\d$/;

export function normalizeTrimmedString(value: string): string {
  return value.trim();
}

export function normalizeOptionalString(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

export function normalizeOptionalNullString(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = normalizeOptionalString(value);
  return normalized ?? null;
}

export function normalizePostalCode(value: string): string {
  const compact = value.trim().toUpperCase().replace(/[\s-]+/g, "");

  if (CANADIAN_POSTAL_CODE_PATTERN.test(compact)) {
    return `${compact.slice(0, 3)} ${compact.slice(3)}`;
  }

  return compact;
}

export function normalizePhoneNumber(value: string): string {
  const trimmed = value.trim();
  const hasLeadingPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D+/g, "");

  return hasLeadingPlus ? `+${digits}` : digits;
}

export function isValidPhoneNumber(value: string): boolean {
  const normalized = normalizePhoneNumber(value);
  const digits = normalized.startsWith("+") ? normalized.slice(1) : normalized;

  return PHONE_DIGIT_PATTERN.test(digits);
}
