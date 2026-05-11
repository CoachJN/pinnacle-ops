export function isValidCurrencyThresholdInput(value: string): boolean {
  const normalized = value.trim();
  if (!normalized) {
    return true;
  }

  return /^\d+(?:\.\d{1,2})?$/.test(normalized);
}

export function parseQuoteThresholdDollarsToCents(value: string): number | undefined {
  const normalized = value.trim();
  if (!normalized) {
    return undefined;
  }

  if (!isValidCurrencyThresholdInput(normalized)) {
    return undefined;
  }

  return Math.round(Number(normalized) * 100);
}

export function formatQuoteThresholdInput(value: string): string {
  const normalized = value.trim();
  if (!normalized || !isValidCurrencyThresholdInput(normalized)) {
    return value;
  }

  return Number(normalized).toFixed(2);
}
