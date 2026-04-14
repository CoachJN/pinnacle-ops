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
] as const satisfies readonly InvoiceStatus[];

export const WORK_ORDER_TRANSITIONS = {
  new: ["in_review", "cancelled"],
  draft: ["submitted", "cancelled"],
  submitted: ["in_review", "cancelled"],
  in_review: ["quote_requested", "approved_to_proceed", "cancelled"],
  quote_requested: ["quote_received", "cancelled"],
  quote_received: ["pending_client_approval", "quote_requested", "cancelled"],
  pending_client_approval: ["approved_to_proceed", "quote_requested", "cancelled"],
  approved_to_proceed: ["dispatched", "assigned", "scheduled", "cancelled"],
  dispatched: ["assigned", "in_progress", "waiting_on_contractor", "cancelled"],
  assigned: ["scheduled", "in_progress", "waiting_on_contractor", "cancelled"],
  scheduled: ["in_progress", "waiting_on_contractor", "cancelled"],
  in_progress: ["waiting_on_contractor", "waiting_on_customer", "completed", "cancelled"],
  waiting_on_contractor: ["in_progress", "completed", "cancelled"],
  waiting_on_customer: ["in_progress", "completed", "cancelled"],
  quoted: ["approved", "cancelled"],
  approved: ["scheduled", "dispatched", "assigned", "cancelled"],
  completed: ["ready_for_invoicing", "invoiced", "closed"],
  ready_for_invoicing: ["invoiced", "closed"],
  invoiced: ["paid", "cancelled"],
  paid: ["closed"],
  closed: [],
  cancelled: [],
} as const satisfies Record<WorkOrderStatus, readonly WorkOrderStatus[]>;

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
  draft: ["sent", "void"],
  issued: ["viewed", "overdue", "paid", "void"],
  sent: ["viewed", "overdue", "paid", "void"],
  viewed: ["overdue", "paid", "void"],
  overdue: ["paid"],
  paid: [],
  void: [],
} as const satisfies Record<InvoiceStatus, readonly InvoiceStatus[]>;

export function canWorkOrderTransition(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): boolean {
  return (WORK_ORDER_TRANSITIONS[from] as readonly WorkOrderStatus[]).includes(to);
}

export function canQuoteTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return (QUOTE_TRANSITIONS[from] as readonly QuoteStatus[]).includes(to);
}

export function canInvoiceTransition(
  from: InvoiceStatus,
  to: InvoiceStatus,
): boolean {
  const transitions =
    from === "issued"
      ? INVOICE_TRANSITIONS.issued
      : INVOICE_TRANSITIONS[from as Exclude<InvoiceStatus, "issued">];
  return (transitions as readonly InvoiceStatus[]).includes(to);
}

export function isTerminalWorkOrderStatus(status: WorkOrderStatus): boolean {
  return (TERMINAL_WORK_ORDER_STATUSES as readonly WorkOrderStatus[]).includes(
    status,
  );
}

export function isTerminalQuoteStatus(status: QuoteStatus): boolean {
  return (TERMINAL_QUOTE_STATUSES as readonly QuoteStatus[]).includes(status);
}

export function isTerminalInvoiceStatus(status: InvoiceStatus): boolean {
  return (TERMINAL_INVOICE_STATUSES as readonly InvoiceStatus[]).includes(status);
}
