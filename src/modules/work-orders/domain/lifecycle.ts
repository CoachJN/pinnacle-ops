export const WORK_ORDER_LIFECYCLE_STATUSES = [
  "new",
  "triage",
  "assigned",
  "awaiting_contractor_response",
  "quote_required",
  "contractor_quote_received",
  "quote_under_review",
  "client_approval_requested",
  "client_approved",
  "contractor_scheduled",
  "in_progress",
  "work_completed",
  "completion_review",
  "ready_for_invoicing",
  "invoiced",
  "paid",
  "closed",
  "on_hold",
  "escalated",
  "cancelled",
] as const;

export type WorkOrderLifecycleStatus =
  (typeof WORK_ORDER_LIFECYCLE_STATUSES)[number];

export const TERMINAL_WORK_ORDER_LIFECYCLE_STATUSES = [
  "closed",
  "cancelled",
] as const satisfies readonly WorkOrderLifecycleStatus[];

export const WORK_ORDER_LIFECYCLE_LABELS = {
  new: "New",
  triage: "Triage",
  assigned: "Assigned",
  awaiting_contractor_response: "Awaiting Contractor Response",
  quote_required: "Quote Required",
  contractor_quote_received: "Contractor Quote Received",
  quote_under_review: "Quote Under Review",
  client_approval_requested: "Client Approval Requested",
  client_approved: "Client Approved",
  contractor_scheduled: "Contractor Scheduled",
  in_progress: "In Progress",
  work_completed: "Work Completed",
  completion_review: "Completion Review",
  ready_for_invoicing: "Ready for Invoicing",
  invoiced: "Invoiced",
  paid: "Paid",
  closed: "Closed",
  on_hold: "On Hold",
  escalated: "Escalated",
  cancelled: "Cancelled",
} as const satisfies Record<WorkOrderLifecycleStatus, string>;

export const WORK_ORDER_LIFECYCLE_TRANSITIONS = {
  new: ["triage", "cancelled"],
  triage: ["assigned", "quote_required", "on_hold", "escalated", "cancelled"],
  assigned: [
    "awaiting_contractor_response",
    "quote_required",
    "contractor_scheduled",
    "on_hold",
    "escalated",
    "cancelled",
  ],
  awaiting_contractor_response: [
    "assigned",
    "quote_required",
    "contractor_scheduled",
    "on_hold",
    "escalated",
    "cancelled",
  ],
  quote_required: ["contractor_quote_received", "on_hold", "escalated", "cancelled"],
  contractor_quote_received: [
    "quote_under_review",
    "on_hold",
    "escalated",
    "cancelled",
  ],
  quote_under_review: [
    "client_approval_requested",
    "quote_required",
    "on_hold",
    "escalated",
    "cancelled",
  ],
  client_approval_requested: [
    "client_approved",
    "quote_required",
    "on_hold",
    "escalated",
    "cancelled",
  ],
  client_approved: [
    "assigned",
    "contractor_scheduled",
    "on_hold",
    "escalated",
    "cancelled",
  ],
  contractor_scheduled: ["in_progress", "on_hold", "escalated", "cancelled"],
  in_progress: ["work_completed", "on_hold", "escalated", "cancelled"],
  work_completed: ["completion_review", "on_hold", "escalated"],
  completion_review: ["ready_for_invoicing", "assigned", "on_hold", "escalated"],
  ready_for_invoicing: ["invoiced", "on_hold", "escalated"],
  invoiced: ["ready_for_invoicing", "paid", "on_hold", "escalated"],
  paid: ["closed"],
  closed: [],
  on_hold: ["escalated", "cancelled"],
  escalated: ["on_hold", "cancelled"],
  cancelled: [],
} as const satisfies Record<
  WorkOrderLifecycleStatus,
  readonly WorkOrderLifecycleStatus[]
>;

export interface WorkOrderLifecycleTransitionContext {
  previousLifecycleStatus?: WorkOrderLifecycleStatus | null;
  holdReason?: string | null;
  escalationReason?: string | null;
  allowInvoiceReopen?: boolean;
}

export function getWorkOrderLifecycleLabel(
  status: WorkOrderLifecycleStatus,
): string {
  return WORK_ORDER_LIFECYCLE_LABELS[status];
}

export function getAllowedNextWorkOrderLifecycleStatuses(
  status: WorkOrderLifecycleStatus,
  context: Pick<
    WorkOrderLifecycleTransitionContext,
    "previousLifecycleStatus" | "allowInvoiceReopen"
  > = {},
): readonly WorkOrderLifecycleStatus[] {
  if (status === "on_hold" || status === "escalated") {
    return context.previousLifecycleStatus
      ? [context.previousLifecycleStatus, ...WORK_ORDER_LIFECYCLE_TRANSITIONS[status]]
      : WORK_ORDER_LIFECYCLE_TRANSITIONS[status];
  }

  if (status === "invoiced" && context.allowInvoiceReopen !== true) {
    return WORK_ORDER_LIFECYCLE_TRANSITIONS.invoiced.filter(
      (nextStatus) => nextStatus !== "ready_for_invoicing",
    );
  }

  return WORK_ORDER_LIFECYCLE_TRANSITIONS[status];
}

export function isTerminalWorkOrderLifecycleStatus(
  status: WorkOrderLifecycleStatus,
): boolean {
  return (
    TERMINAL_WORK_ORDER_LIFECYCLE_STATUSES as readonly WorkOrderLifecycleStatus[]
  ).includes(status);
}

export function isWorkOrderLifecycleTransitionAllowed(
  from: WorkOrderLifecycleStatus,
  to: WorkOrderLifecycleStatus,
  context: WorkOrderLifecycleTransitionContext = {},
): boolean {
  if (
    (from === "on_hold" || from === "escalated") &&
    context.previousLifecycleStatus &&
    to === context.previousLifecycleStatus
  ) {
    return true;
  }

  if (
    from === "invoiced" &&
    to === "ready_for_invoicing" &&
    context.allowInvoiceReopen !== true
  ) {
    return false;
  }

  return (
    WORK_ORDER_LIFECYCLE_TRANSITIONS[from] as readonly WorkOrderLifecycleStatus[]
  ).includes(to);
}

export function validateWorkOrderLifecycleTransition(
  from: WorkOrderLifecycleStatus,
  to: WorkOrderLifecycleStatus,
  context: WorkOrderLifecycleTransitionContext = {},
): string | null {
  if (!isWorkOrderLifecycleTransitionAllowed(from, to, context)) {
    return `Work order cannot transition from ${from} to ${to}.`;
  }

  if (from === "paid" && to !== "closed") {
    return "Paid work orders may only transition to closed.";
  }

  if (to === "on_hold") {
    if (!context.holdReason?.trim()) {
      return "Moving a work order to on_hold requires holdReason.";
    }
    if (!context.previousLifecycleStatus) {
      return "Moving a work order to on_hold requires previousLifecycleStatus.";
    }
  }

  if (to === "escalated") {
    if (!context.escalationReason?.trim()) {
      return "Moving a work order to escalated requires escalationReason.";
    }
    if (!context.previousLifecycleStatus) {
      return "Moving a work order to escalated requires previousLifecycleStatus.";
    }
  }

  if (from === "invoiced" && to === "ready_for_invoicing" && !context.allowInvoiceReopen) {
    return "Returning an invoiced work order to ready_for_invoicing requires invoice void/reissue context.";
  }

  if (
    (from === "on_hold" || from === "escalated") &&
    to !== "cancelled" &&
    to !== "on_hold" &&
    to !== "escalated" &&
    context.previousLifecycleStatus !== to
  ) {
    return `${from} may only resume to previousLifecycleStatus or move to a terminal exception path.`;
  }

  return null;
}
