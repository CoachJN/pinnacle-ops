"use client";

import {
  getWorkOrderStatusLabel,
  type WorkOrderStatus,
} from "@/modules/work-orders";

const STATUS_STYLES = {
  new: "border-sky-200 bg-sky-50 text-sky-800",
  triage: "border-cyan-200 bg-cyan-50 text-cyan-800",
  assigned: "border-violet-200 bg-violet-50 text-violet-800",
  awaiting_contractor_response: "border-indigo-200 bg-indigo-50 text-indigo-800",
  quote_required: "border-amber-200 bg-amber-50 text-amber-900",
  contractor_quote_received: "border-teal-200 bg-teal-50 text-teal-800",
  quote_under_review: "border-lime-200 bg-lime-50 text-lime-900",
  client_approval_requested: "border-yellow-200 bg-yellow-50 text-yellow-900",
  client_approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  contractor_scheduled: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
  in_progress: "border-orange-200 bg-orange-50 text-orange-900",
  work_completed: "border-green-200 bg-green-50 text-green-800",
  completion_review: "border-blue-200 bg-blue-50 text-blue-800",
  ready_for_invoicing: "border-sky-200 bg-sky-50 text-sky-900",
  invoiced: "border-cyan-200 bg-cyan-50 text-cyan-900",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-900",
  closed: "border-neutral-300 bg-neutral-100 text-neutral-700",
  on_hold: "border-stone-300 bg-stone-100 text-stone-700",
  escalated: "border-rose-200 bg-rose-50 text-rose-900",
  cancelled: "border-rose-200 bg-rose-50 text-rose-800",
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
