"use client";

import {
  getWorkOrderPriorityLabel,
  type WorkOrderPriority,
} from "@/modules/work-orders";

const PRIORITY_STYLES = {
  LOW: "border-neutral-300 bg-neutral-50 text-neutral-700",
  MEDIUM: "border-sky-200 bg-sky-50 text-sky-800",
  HIGH: "border-amber-200 bg-amber-50 text-amber-900",
  URGENT: "border-rose-200 bg-rose-50 text-rose-800",
} as const satisfies Record<WorkOrderPriority, string>;

export function WorkOrderPriorityBadge({
  priority,
}: {
  priority: WorkOrderPriority;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${PRIORITY_STYLES[priority]}`}
    >
      {getWorkOrderPriorityLabel(priority)}
    </span>
  );
}
