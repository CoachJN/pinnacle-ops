import type { WorkOrderStatus } from "./constants";

export const WORK_ORDER_STATUS_TRANSITION_MAP = {
  NEW: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: ["CLOSED"],
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
