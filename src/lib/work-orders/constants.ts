import type { WorkOrderPriority } from "../../types/work-order.ts";

export const WORK_ORDER_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const satisfies readonly WorkOrderPriority[];

export const WORK_ORDER_PRIORITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
} as const satisfies Record<WorkOrderPriority, string>;

export function parseWorkOrderPriority(
  value: FormDataEntryValue | string | null | undefined,
): WorkOrderPriority | null {
  if (typeof value !== "string") {
    return null;
  }

  return (WORK_ORDER_PRIORITIES as readonly string[]).includes(value)
    ? (value as WorkOrderPriority)
    : null;
}
