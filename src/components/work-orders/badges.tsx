import type {
  PhaseOneWorkOrderStatus,
  WorkOrderPriority,
} from "@/types/work-order";
import { WORK_ORDER_PRIORITY_LABELS } from "@/lib/work-orders/constants";
import { WORK_ORDER_STATUS_LABELS } from "@/lib/work-orders/status";
import { cn } from "@/lib/utils";

const statusClassName = {
  new: "border-sky-200 bg-sky-50 text-sky-800",
  in_review: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
  quote_requested: "border-amber-200 bg-amber-50 text-amber-900",
  quote_received: "border-teal-200 bg-teal-50 text-teal-800",
  pending_client_approval: "border-indigo-200 bg-indigo-50 text-indigo-800",
  approved_to_proceed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  dispatched: "border-cyan-200 bg-cyan-50 text-cyan-800",
  in_progress: "border-orange-200 bg-orange-50 text-orange-800",
  completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  invoiced: "border-violet-200 bg-violet-50 text-violet-800",
  paid: "border-lime-200 bg-lime-50 text-lime-800",
  closed: "border-neutral-300 bg-neutral-100 text-neutral-700",
  cancelled: "border-rose-200 bg-rose-50 text-rose-800",
} as const satisfies Record<PhaseOneWorkOrderStatus, string>;

const priorityClassName = {
  low: "border-neutral-200 bg-white text-neutral-700",
  medium: "border-sky-200 bg-sky-50 text-sky-800",
  high: "border-amber-200 bg-amber-50 text-amber-800",
  urgent: "border-rose-200 bg-rose-50 text-rose-800",
} as const satisfies Record<WorkOrderPriority, string>;

export function StatusBadge({ status }: { status: PhaseOneWorkOrderStatus }) {
  return (
    <span className={cn("inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold", statusClassName[status])}>
      {WORK_ORDER_STATUS_LABELS[status]}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: WorkOrderPriority }) {
  return (
    <span className={cn("inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold", priorityClassName[priority])}>
      {WORK_ORDER_PRIORITY_LABELS[priority]}
    </span>
  );
}
