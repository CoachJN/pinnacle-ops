import {
  WORK_ORDER_LIFECYCLE_LABELS,
  WORK_ORDER_LIFECYCLE_STATUSES,
  type WorkOrderLifecycleStatus,
} from "@/modules/work-orders";
import { includesStatus, type LifecycleStatusMetadata } from "./types.ts";

export const WORK_ORDER_STATUS = {
  New: "new",
  Triage: "triage",
  Assigned: "assigned",
  AwaitingContractorResponse: "awaiting_contractor_response",
  QuoteRequired: "quote_required",
  ContractorQuoteReceived: "contractor_quote_received",
  QuoteUnderReview: "quote_under_review",
  ClientApprovalRequested: "client_approval_requested",
  ClientApproved: "client_approved",
  ContractorScheduled: "contractor_scheduled",
  InProgress: "in_progress",
  WorkCompleted: "work_completed",
  CompletionReview: "completion_review",
  ReadyForInvoicing: "ready_for_invoicing",
  Invoiced: "invoiced",
  Paid: "paid",
  Closed: "closed",
  OnHold: "on_hold",
  Escalated: "escalated",
  Cancelled: "cancelled",
  QuotingRequired: "quote_required",
  AwaitingQuote: "quote_required",
  QuoteReceived: "contractor_quote_received",
  QuoteReview: "quote_under_review",
  AwaitingClientApproval: "client_approval_requested",
  ApprovedToProceed: "client_approved",
  Scheduling: "assigned",
  Scheduled: "contractor_scheduled",
  QaReview: "completion_review",
  Completed: "closed",
} as const satisfies Record<string, WorkOrderLifecycleStatus>;

export type { WorkOrderLifecycleStatus };

export type WorkOrderLifecycleCategory =
  | "intake"
  | "dispatch"
  | "quote"
  | "execution"
  | "finance"
  | "exception"
  | "terminal";

export const WORK_ORDER_STATUSES =
  WORK_ORDER_LIFECYCLE_STATUSES as readonly WorkOrderLifecycleStatus[];

export const TERMINAL_WORK_ORDER_STATUSES = [
  WORK_ORDER_STATUS.Closed,
  WORK_ORDER_STATUS.Cancelled,
] as const satisfies readonly WorkOrderLifecycleStatus[];

export const ACTIVE_WORK_ORDER_STATUSES = WORK_ORDER_STATUSES.filter(
  (status) => !includesStatus(TERMINAL_WORK_ORDER_STATUSES, status),
) as readonly WorkOrderLifecycleStatus[];

export const NON_TERMINAL_WORK_ORDER_STATUSES =
  ACTIVE_WORK_ORDER_STATUSES as readonly WorkOrderLifecycleStatus[];

export const WORK_ORDER_STATUS_LABELS = WORK_ORDER_LIFECYCLE_LABELS;

export const WORK_ORDER_STATUS_CATEGORIES = {
  new: "intake",
  triage: "intake",
  assigned: "dispatch",
  awaiting_contractor_response: "dispatch",
  quote_required: "quote",
  contractor_quote_received: "quote",
  quote_under_review: "quote",
  client_approval_requested: "quote",
  client_approved: "quote",
  contractor_scheduled: "dispatch",
  in_progress: "execution",
  work_completed: "execution",
  completion_review: "finance",
  ready_for_invoicing: "finance",
  invoiced: "finance",
  paid: "finance",
  closed: "terminal",
  on_hold: "exception",
  escalated: "exception",
  cancelled: "terminal",
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
