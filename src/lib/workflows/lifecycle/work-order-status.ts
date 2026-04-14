import { includesStatus, type LifecycleStatusMetadata } from "./types.ts";

export const WORK_ORDER_STATUS = {
  New: "NEW",
  Triage: "TRIAGE",
  QuotingRequired: "QUOTING_REQUIRED",
  AwaitingQuote: "AWAITING_QUOTE",
  QuoteReceived: "QUOTE_RECEIVED",
  QuoteReview: "QUOTE_REVIEW",
  AwaitingClientApproval: "AWAITING_CLIENT_APPROVAL",
  ApprovedToProceed: "APPROVED_TO_PROCEED",
  Scheduling: "SCHEDULING",
  Scheduled: "SCHEDULED",
  InProgress: "IN_PROGRESS",
  WorkCompleted: "WORK_COMPLETED",
  QaReview: "QA_REVIEW",
  ReadyForInvoicing: "READY_FOR_INVOICING",
  Completed: "COMPLETED",
  OnHold: "ON_HOLD",
  Escalated: "ESCALATED",
  Cancelled: "CANCELLED",
} as const;

export type WorkOrderLifecycleStatus =
  (typeof WORK_ORDER_STATUS)[keyof typeof WORK_ORDER_STATUS];

export type WorkOrderLifecycleCategory =
  | "intake"
  | "quoting"
  | "approval"
  | "scheduling"
  | "execution"
  | "completion"
  | "exception"
  | "terminal";

export const WORK_ORDER_STATUSES = [
  WORK_ORDER_STATUS.New,
  WORK_ORDER_STATUS.Triage,
  WORK_ORDER_STATUS.QuotingRequired,
  WORK_ORDER_STATUS.AwaitingQuote,
  WORK_ORDER_STATUS.QuoteReceived,
  WORK_ORDER_STATUS.QuoteReview,
  WORK_ORDER_STATUS.AwaitingClientApproval,
  WORK_ORDER_STATUS.ApprovedToProceed,
  WORK_ORDER_STATUS.Scheduling,
  WORK_ORDER_STATUS.Scheduled,
  WORK_ORDER_STATUS.InProgress,
  WORK_ORDER_STATUS.WorkCompleted,
  WORK_ORDER_STATUS.QaReview,
  WORK_ORDER_STATUS.ReadyForInvoicing,
  WORK_ORDER_STATUS.Completed,
  WORK_ORDER_STATUS.OnHold,
  WORK_ORDER_STATUS.Escalated,
  WORK_ORDER_STATUS.Cancelled,
] as const satisfies readonly WorkOrderLifecycleStatus[];

export const TERMINAL_WORK_ORDER_STATUSES = [
  WORK_ORDER_STATUS.Completed,
  WORK_ORDER_STATUS.Cancelled,
] as const satisfies readonly WorkOrderLifecycleStatus[];

export const ACTIVE_WORK_ORDER_STATUSES = [
  WORK_ORDER_STATUS.New,
  WORK_ORDER_STATUS.Triage,
  WORK_ORDER_STATUS.QuotingRequired,
  WORK_ORDER_STATUS.AwaitingQuote,
  WORK_ORDER_STATUS.QuoteReceived,
  WORK_ORDER_STATUS.QuoteReview,
  WORK_ORDER_STATUS.AwaitingClientApproval,
  WORK_ORDER_STATUS.ApprovedToProceed,
  WORK_ORDER_STATUS.Scheduling,
  WORK_ORDER_STATUS.Scheduled,
  WORK_ORDER_STATUS.InProgress,
  WORK_ORDER_STATUS.WorkCompleted,
  WORK_ORDER_STATUS.QaReview,
  WORK_ORDER_STATUS.ReadyForInvoicing,
] as const satisfies readonly WorkOrderLifecycleStatus[];

export const NON_TERMINAL_WORK_ORDER_STATUSES = [
  ...ACTIVE_WORK_ORDER_STATUSES,
  WORK_ORDER_STATUS.OnHold,
  WORK_ORDER_STATUS.Escalated,
] as const satisfies readonly WorkOrderLifecycleStatus[];

export const WORK_ORDER_STATUS_LABELS = {
  [WORK_ORDER_STATUS.New]: "New",
  [WORK_ORDER_STATUS.Triage]: "Triage",
  [WORK_ORDER_STATUS.QuotingRequired]: "Quoting Required",
  [WORK_ORDER_STATUS.AwaitingQuote]: "Awaiting Quote",
  [WORK_ORDER_STATUS.QuoteReceived]: "Quote Received",
  [WORK_ORDER_STATUS.QuoteReview]: "Quote Review",
  [WORK_ORDER_STATUS.AwaitingClientApproval]: "Awaiting Client Approval",
  [WORK_ORDER_STATUS.ApprovedToProceed]: "Approved to Proceed",
  [WORK_ORDER_STATUS.Scheduling]: "Scheduling",
  [WORK_ORDER_STATUS.Scheduled]: "Scheduled",
  [WORK_ORDER_STATUS.InProgress]: "In Progress",
  [WORK_ORDER_STATUS.WorkCompleted]: "Work Completed",
  [WORK_ORDER_STATUS.QaReview]: "QA Review",
  [WORK_ORDER_STATUS.ReadyForInvoicing]: "Ready for Invoicing",
  [WORK_ORDER_STATUS.Completed]: "Completed",
  [WORK_ORDER_STATUS.OnHold]: "On Hold",
  [WORK_ORDER_STATUS.Escalated]: "Escalated",
  [WORK_ORDER_STATUS.Cancelled]: "Cancelled",
} as const satisfies Record<WorkOrderLifecycleStatus, string>;

export const WORK_ORDER_STATUS_CATEGORIES = {
  [WORK_ORDER_STATUS.New]: "intake",
  [WORK_ORDER_STATUS.Triage]: "intake",
  [WORK_ORDER_STATUS.QuotingRequired]: "quoting",
  [WORK_ORDER_STATUS.AwaitingQuote]: "quoting",
  [WORK_ORDER_STATUS.QuoteReceived]: "quoting",
  [WORK_ORDER_STATUS.QuoteReview]: "quoting",
  [WORK_ORDER_STATUS.AwaitingClientApproval]: "approval",
  [WORK_ORDER_STATUS.ApprovedToProceed]: "approval",
  [WORK_ORDER_STATUS.Scheduling]: "scheduling",
  [WORK_ORDER_STATUS.Scheduled]: "scheduling",
  [WORK_ORDER_STATUS.InProgress]: "execution",
  [WORK_ORDER_STATUS.WorkCompleted]: "execution",
  [WORK_ORDER_STATUS.QaReview]: "completion",
  [WORK_ORDER_STATUS.ReadyForInvoicing]: "completion",
  [WORK_ORDER_STATUS.Completed]: "terminal",
  [WORK_ORDER_STATUS.OnHold]: "exception",
  [WORK_ORDER_STATUS.Escalated]: "exception",
  [WORK_ORDER_STATUS.Cancelled]: "terminal",
} as const satisfies Record<WorkOrderLifecycleStatus, WorkOrderLifecycleCategory>;

export const WORK_ORDER_STATUS_METADATA = WORK_ORDER_STATUSES.map((status) => ({
  status,
  label: WORK_ORDER_STATUS_LABELS[status],
  category: WORK_ORDER_STATUS_CATEGORIES[status],
  terminal: includesStatus<WorkOrderLifecycleStatus>(
    TERMINAL_WORK_ORDER_STATUSES,
    status,
  ),
})) as readonly LifecycleStatusMetadata<
  WorkOrderLifecycleStatus,
  WorkOrderLifecycleCategory
>[];
