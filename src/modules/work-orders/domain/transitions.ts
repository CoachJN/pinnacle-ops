import type { WorkOrderStatus } from "./constants.ts";
import {
  getAllowedNextWorkOrderLifecycleStatuses,
  isWorkOrderLifecycleTransitionAllowed,
  WORK_ORDER_LIFECYCLE_TRANSITIONS,
} from "./lifecycle.ts";

export const WORK_ORDER_STATUS_TRANSITION_MAP = WORK_ORDER_LIFECYCLE_TRANSITIONS;

export function getAllowedNextWorkOrderStatuses(
  status: WorkOrderStatus,
): readonly WorkOrderStatus[] {
  return getAllowedNextWorkOrderLifecycleStatuses(status);
}

export function isWorkOrderStatusTransitionAllowed(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): boolean {
  return isWorkOrderLifecycleTransitionAllowed(from, to);
}
