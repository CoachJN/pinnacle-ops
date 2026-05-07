import type { WorkOrderPriority } from "@/types/work-order";
import { WORK_ORDER_PRIORITY_LABELS } from "@/lib/work-orders/constants";
import { cn } from "@/lib/utils";

const priorityClassName = {
  low: "border-neutral-200 bg-white text-neutral-700",
  medium: "border-sky-200 bg-sky-50 text-sky-800",
  high: "border-amber-200 bg-amber-50 text-amber-800",
  urgent: "border-rose-200 bg-rose-50 text-rose-800",
} as const satisfies Record<WorkOrderPriority, string>;

export function PriorityBadge({ priority }: { priority: WorkOrderPriority }) {
  return (
    <span className={cn("inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold", priorityClassName[priority])}>
      {WORK_ORDER_PRIORITY_LABELS[priority]}
    </span>
  );
}
