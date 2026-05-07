import {
  canTransition,
  includesStatus,
  type LifecycleTransitionMap,
} from "./types.ts";
import {
  NON_TERMINAL_WORK_ORDER_STATUSES,
  TERMINAL_WORK_ORDER_STATUSES,
  WORK_ORDER_STATUS,
  type WorkOrderLifecycleStatus,
} from "./work-order-status.ts";

export const WORK_ORDER_TRANSITION_MAP = {
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
} as const satisfies LifecycleTransitionMap<WorkOrderLifecycleStatus>;

export function isTerminalWorkOrderStatus(
  status: WorkOrderLifecycleStatus,
): boolean {
  return includesStatus(TERMINAL_WORK_ORDER_STATUSES, status);
}

export function isActiveWorkOrderStatus(
  status: WorkOrderLifecycleStatus,
): boolean {
  return includesStatus(NON_TERMINAL_WORK_ORDER_STATUSES, status);
}

export function isNonTerminalWorkOrderStatus(
  status: WorkOrderLifecycleStatus,
): boolean {
  return includesStatus(NON_TERMINAL_WORK_ORDER_STATUSES, status);
}

export function canWorkOrderTransition(
  from: WorkOrderLifecycleStatus,
  to: WorkOrderLifecycleStatus,
): boolean {
  if (from === WORK_ORDER_STATUS.Paid && to !== WORK_ORDER_STATUS.Closed) {
    return false;
  }

  return canTransition(WORK_ORDER_TRANSITION_MAP, from, to);
}
