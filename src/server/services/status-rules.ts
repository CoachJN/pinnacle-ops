import {
  getAllowedNextWorkOrderLifecycleStatuses,
  isTerminalWorkOrderLifecycleStatus,
  isWorkOrderLifecycleTransitionAllowed,
  validateWorkOrderLifecycleTransition,
  WORK_ORDER_LIFECYCLE_TRANSITIONS,
  type WorkOrderLifecycleTransitionContext,
} from "@/modules/work-orders";
import type { InvoiceStatus } from "@/types/invoice";
import type { QuoteStatus } from "@/types/quote";
import type { WorkOrderStatus } from "@/types/work-order";

export const TERMINAL_WORK_ORDER_STATUSES = [
  "closed",
  "cancelled",
] as const satisfies readonly WorkOrderStatus[];

export const TERMINAL_QUOTE_STATUSES = [
  "client_approved",
  "client_rejected",
  "superseded",
] as const satisfies readonly QuoteStatus[];

export const TERMINAL_INVOICE_STATUSES = [
  "paid",
  "void",
  "cancelled",
] as const satisfies readonly InvoiceStatus[];

export const WORK_ORDER_TRANSITIONS = WORK_ORDER_LIFECYCLE_TRANSITIONS;

export const QUOTE_TRANSITIONS = {
  draft: ["submitted", "superseded"],
  submitted: ["under_review", "superseded"],
  under_review: ["ready_for_client", "superseded"],
  ready_for_client: ["client_approved", "client_rejected", "superseded"],
  client_approved: [],
  client_rejected: [],
  superseded: [],
} as const satisfies Record<QuoteStatus, readonly QuoteStatus[]>;

export const INVOICE_TRANSITIONS = {
  draft: ["sent", "void", "cancelled"],
  issued: ["viewed", "overdue", "paid", "void", "disputed", "cancelled"],
  sent: ["viewed", "overdue", "paid", "void", "disputed", "cancelled"],
  viewed: ["overdue", "paid", "void", "disputed"],
  overdue: ["paid", "disputed"],
  disputed: ["resolved", "void", "sent"],
  resolved: ["sent", "paid", "void", "disputed"],
  paid: [],
  void: [],
  cancelled: [],
} as const satisfies Record<InvoiceStatus, readonly InvoiceStatus[]>;

export function canWorkOrderTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
  context: WorkOrderLifecycleTransitionContext = {},
): boolean {
  return isWorkOrderLifecycleTransitionAllowed(from, to, context);
}

export function getWorkOrderTransitions(
  status: WorkOrderStatus,
  context: Pick<
    WorkOrderLifecycleTransitionContext,
    "previousLifecycleStatus" | "allowInvoiceReopen"
  > = {},
): readonly WorkOrderStatus[] {
  return getAllowedNextWorkOrderLifecycleStatuses(status, context);
}

export function getWorkOrderTransitionValidationError(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
  context: WorkOrderLifecycleTransitionContext = {},
): string | null {
  return validateWorkOrderLifecycleTransition(from, to, context);
}

export function canQuoteTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return (QUOTE_TRANSITIONS[from] as readonly QuoteStatus[]).includes(to);
}

export function canInvoiceTransition(
  from: InvoiceStatus,
  to: InvoiceStatus,
): boolean {
  return (INVOICE_TRANSITIONS[from] as readonly InvoiceStatus[]).includes(to);
}

export function isTerminalWorkOrderStatus(status: WorkOrderStatus): boolean {
  return isTerminalWorkOrderLifecycleStatus(status);
}

export function isTerminalQuoteStatus(status: QuoteStatus): boolean {
  return (TERMINAL_QUOTE_STATUSES as readonly QuoteStatus[]).includes(status);
}

export function isTerminalInvoiceStatus(status: InvoiceStatus): boolean {
  return (TERMINAL_INVOICE_STATUSES as readonly InvoiceStatus[]).includes(status);
}
