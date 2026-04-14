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

export type StatusNormalizationSource = "lifecycle" | "legacy";

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

const legacyWorkOrderStatusMap = {
  draft: WORK_ORDER_STATUS.New,
  submitted: WORK_ORDER_STATUS.Triage,
  approved: WORK_ORDER_STATUS.ApprovedToProceed,
  assigned: WORK_ORDER_STATUS.Scheduling,
  scheduled: WORK_ORDER_STATUS.Scheduled,
  in_progress: WORK_ORDER_STATUS.InProgress,
  waiting_on_contractor: WORK_ORDER_STATUS.OnHold,
  waiting_on_customer: WORK_ORDER_STATUS.OnHold,
  quoted: WORK_ORDER_STATUS.AwaitingClientApproval,
  completed: WORK_ORDER_STATUS.ReadyForInvoicing,
  invoiced: WORK_ORDER_STATUS.Completed,
  closed: WORK_ORDER_STATUS.Completed,
  cancelled: WORK_ORDER_STATUS.Cancelled,
} as const satisfies Record<string, WorkOrderLifecycleStatus>;

const legacyQuoteStatusMap = {
  draft: QUOTE_STATUS.Requested,
  submitted: QUOTE_STATUS.Submitted,
  accepted: QUOTE_STATUS.ApprovedInternal,
  sent: QUOTE_STATUS.SentToClient,
  approved: QUOTE_STATUS.ClientApproved,
  rejected: QUOTE_STATUS.ClientRejected,
  expired: QUOTE_STATUS.Expired,
  cancelled: QUOTE_STATUS.Cancelled,
} as const satisfies Record<string, QuoteLifecycleStatus>;

const legacyInvoiceStatusMap = {
  draft: INVOICE_STATUS.Draft,
  issued: INVOICE_STATUS.Sent,
  sent: INVOICE_STATUS.Sent,
  overdue: INVOICE_STATUS.Overdue,
  disputed: INVOICE_STATUS.Overdue,
  resolved: INVOICE_STATUS.Sent,
  paid: INVOICE_STATUS.Paid,
  void: INVOICE_STATUS.Voided,
  cancelled: INVOICE_STATUS.Voided,
} as const satisfies Record<string, InvoiceLifecycleStatus>;

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
  return normalizeStatus(
    value,
    WORK_ORDER_STATUSES,
    legacyWorkOrderStatusMap,
    "work-order",
  );
}

export function normalizeQuoteStatusResult(
  value: QuoteLifecycleStatus | string | null | undefined,
): StatusNormalizationResult<QuoteLifecycleStatus> {
  return normalizeStatus(value, QUOTE_STATUSES, legacyQuoteStatusMap, "quote");
}

export function normalizeInvoiceStatusResult(
  value: InvoiceLifecycleStatus | string | null | undefined,
): StatusNormalizationResult<InvoiceLifecycleStatus> {
  return normalizeStatus(value, INVOICE_STATUSES, legacyInvoiceStatusMap, "invoice");
}

function normalizeStatus<TStatus extends string>(
  value: TStatus | string | null | undefined,
  lifecycleStatuses: readonly TStatus[],
  legacyStatusMap: Readonly<Record<string, TStatus>>,
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

  const legacyStatus = legacyStatusMap[value];
  if (legacyStatus) {
    return { ok: true, status: legacyStatus, source: "legacy", original: value };
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
