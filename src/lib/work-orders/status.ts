import type { PhaseOneWorkOrderStatus } from "../../types/work-order.ts";

export const WORK_ORDER_STATUSES = [
  "new",
  "in_review",
  "quote_requested",
  "quote_received",
  "pending_client_approval",
  "approved_to_proceed",
  "dispatched",
  "in_progress",
  "completed",
  "invoiced",
  "paid",
  "closed",
  "cancelled",
] as const satisfies readonly PhaseOneWorkOrderStatus[];

export const TERMINAL_WORK_ORDER_STATUSES = [
  "closed",
  "cancelled",
] as const satisfies readonly PhaseOneWorkOrderStatus[];

export const WORK_ORDER_STATUS_LABELS = {
  new: "New",
  in_review: "In Review",
  quote_requested: "Quote Requested",
  quote_received: "Quote Received",
  pending_client_approval: "Pending Client Approval",
  approved_to_proceed: "Approved to Proceed",
  dispatched: "Dispatched",
  in_progress: "In Progress",
  completed: "Completed",
  invoiced: "Invoiced",
  paid: "Paid",
  closed: "Closed",
  cancelled: "Cancelled",
} as const satisfies Record<PhaseOneWorkOrderStatus, string>;

export const WORK_ORDER_TRANSITIONS = {
  new: ["in_review", "cancelled"],
  in_review: ["quote_requested", "dispatched", "cancelled"],
  quote_requested: ["quote_received", "cancelled"],
  quote_received: ["pending_client_approval", "quote_requested", "cancelled"],
  pending_client_approval: [
    "approved_to_proceed",
    "quote_requested",
    "cancelled",
  ],
  approved_to_proceed: ["dispatched", "cancelled"],
  dispatched: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["invoiced", "cancelled"],
  invoiced: ["paid"],
  paid: ["closed"],
  closed: [],
  cancelled: [],
} as const satisfies Record<
  PhaseOneWorkOrderStatus,
  readonly PhaseOneWorkOrderStatus[]
>;

export function getAllowedStatusTransitions(
  status: PhaseOneWorkOrderStatus,
): readonly PhaseOneWorkOrderStatus[] {
  return WORK_ORDER_TRANSITIONS[status];
}

export function isTerminalWorkOrderStatus(
  status: PhaseOneWorkOrderStatus,
): boolean {
  return (TERMINAL_WORK_ORDER_STATUSES as readonly PhaseOneWorkOrderStatus[]).includes(
    status,
  );
}

export function canTransitionWorkOrderStatus(
  from: PhaseOneWorkOrderStatus,
  to: PhaseOneWorkOrderStatus,
): boolean {
  return getAllowedStatusTransitions(from).includes(to);
}

export function parseWorkOrderStatus(
  value: FormDataEntryValue | string | null | undefined,
): PhaseOneWorkOrderStatus | null {
  if (typeof value !== "string") {
    return null;
  }

  return (WORK_ORDER_STATUSES as readonly string[]).includes(value)
    ? (value as PhaseOneWorkOrderStatus)
    : null;
}
