import {
  FINANCE_QUEUE_FILTERS,
  type FinanceQueueFilter,
} from "../domain/invoice-rules.ts";

export interface FinanceQueueFilterParseResult {
  filter: FinanceQueueFilter;
  raw: string | null;
}

export function parseFinanceQueueFilter(
  value: string | null | undefined,
): FinanceQueueFilterParseResult {
  const normalized = value?.trim() ?? "";
  if (!normalized) {
    return {
      filter: "all",
      raw: null,
    };
  }

  if (
    (FINANCE_QUEUE_FILTERS as readonly string[]).includes(normalized)
  ) {
    return {
      filter: normalized as FinanceQueueFilter,
      raw: normalized,
    };
  }

  throw new Error(
    "view must be one of all, attention, ready_for_invoicing, draft, sent, overdue, or paid.",
  );
}
