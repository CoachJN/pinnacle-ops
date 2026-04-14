"use client";

import {
  getWorkOrderStatusLabel,
  type WorkOrderStatus,
} from "@/modules/work-orders";

const STATUS_STYLES = {
  NEW: "border-sky-200 bg-sky-50 text-sky-800",
  OPEN: "border-amber-200 bg-amber-50 text-amber-900",
  ASSIGNED: "border-violet-200 bg-violet-50 text-violet-800",
  IN_PROGRESS: "border-orange-200 bg-orange-50 text-orange-900",
  COMPLETED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  READY_FOR_INVOICING: "border-blue-200 bg-blue-50 text-blue-800",
  CANCELLED: "border-rose-200 bg-rose-50 text-rose-800",
  CLOSED: "border-neutral-300 bg-neutral-100 text-neutral-700",
} as const satisfies Record<WorkOrderStatus, string>;

export function WorkOrderStatusBadge({
  status,
}: {
  status: WorkOrderStatus;
}) {
  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {getWorkOrderStatusLabel(status)}
    </span>
  );
}
