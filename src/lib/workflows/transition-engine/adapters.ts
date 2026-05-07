import {
  INVOICE_STATUS,
  INVOICE_STATUSES,
  QUOTE_STATUS,
  QUOTE_STATUSES,
  WORK_ORDER_STATUS,
  WORK_ORDER_STATUSES,
  type InvoiceLifecycleStatus,
  type QuoteLifecycleStatus,
  type WorkOrderLifecycleStatus,
} from "../lifecycle/index.ts";

export type StatusNormalizationSource = "lifecycle";

export interface StatusNormalizationSuccess<TStatus extends string> {
  readonly ok: true;
  readonly status: TStatus;
  readonly source: StatusNormalizationSource;
  readonly original: string;
}

export interface StatusNormalizationFailure {
  readonly ok: false;
  readonly status: null;
  readonly original: string | null | undefined;
  readonly failureCode: "UNKNOWN_STATUS" | "STATUS_MODEL_MISMATCH";
  readonly message: string;
}

export type StatusNormalizationResult<TStatus extends string> =
  | StatusNormalizationSuccess<TStatus>
  | StatusNormalizationFailure;

export function normalizeWorkOrderStatus(
  value: WorkOrderLifecycleStatus | string | null | undefined,
): WorkOrderLifecycleStatus | null {
  return normalizeWorkOrderStatusResult(value).status;
}

export function normalizeQuoteStatus(
  value: QuoteLifecycleStatus | string | null | undefined,
): QuoteLifecycleStatus | null {
  return normalizeQuoteStatusResult(value).status;
}

export function normalizeInvoiceStatus(
  value: InvoiceLifecycleStatus | string | null | undefined,
): InvoiceLifecycleStatus | null {
  return normalizeInvoiceStatusResult(value).status;
}

export function normalizeWorkOrderStatusResult(
  value: WorkOrderLifecycleStatus | string | null | undefined,
): StatusNormalizationResult<WorkOrderLifecycleStatus> {
  return normalizeStatus(value, WORK_ORDER_STATUSES, "work-order");
}

export function normalizeQuoteStatusResult(
  value: QuoteLifecycleStatus | string | null | undefined,
): StatusNormalizationResult<QuoteLifecycleStatus> {
  return normalizeStatus(value, QUOTE_STATUSES, "quote");
}

export function normalizeInvoiceStatusResult(
  value: InvoiceLifecycleStatus | string | null | undefined,
): StatusNormalizationResult<InvoiceLifecycleStatus> {
  return normalizeStatus(value, INVOICE_STATUSES, "invoice");
}

function normalizeStatus<TStatus extends string>(
  value: TStatus | string | null | undefined,
  lifecycleStatuses: readonly TStatus[],
  lifecycle: string,
): StatusNormalizationResult<TStatus> {
  if (typeof value !== "string" || value.length === 0) {
    return {
      ok: false,
      status: null,
      original: value,
      failureCode: "UNKNOWN_STATUS",
      message: `Missing ${lifecycle} status.`,
    };
  }

  if (lifecycleStatuses.includes(value as TStatus)) {
    return { ok: true, status: value as TStatus, source: "lifecycle", original: value };
  }

  const failureCode = value === value.toLowerCase()
    ? "STATUS_MODEL_MISMATCH"
    : "UNKNOWN_STATUS";

  return {
    ok: false,
    status: null,
    original: value,
    failureCode,
    message: `${value} is not a recognized ${lifecycle} lifecycle status.`,
  };
}
