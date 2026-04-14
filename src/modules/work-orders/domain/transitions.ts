import type { WorkOrderStatus } from "./constants.ts";

export const WORK_ORDER_STATUS_TRANSITION_MAP = {
  NEW: ["OPEN", "ASSIGNED", "CANCELLED"],
  OPEN: ["ASSIGNED", "CANCELLED"],
  ASSIGNED: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["READY_FOR_INVOICING", "CLOSED"],
  READY_FOR_INVOICING: ["CLOSED"],
  CANCELLED: ["CLOSED"],
  CLOSED: [],
} as const satisfies Record<WorkOrderStatus, readonly WorkOrderStatus[]>;

export function getAllowedNextWorkOrderStatuses(
  status: WorkOrderStatus,
): readonly WorkOrderStatus[] {
  return WORK_ORDER_STATUS_TRANSITION_MAP[status];
}

export function isWorkOrderStatusTransitionAllowed(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): boolean {
  return getAllowedNextWorkOrderStatuses(from).includes(to);
}
