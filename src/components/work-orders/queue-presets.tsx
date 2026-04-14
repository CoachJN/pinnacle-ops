import Link from "next/link";
import type { InternalUserRole } from "@/types/permissions";
import type { WorkOrderListView } from "@/lib/work-orders/repository";

export type QueuePreset = [string, string];

export const WORK_ORDER_QUEUE_PRESETS: readonly QueuePreset[] = [
  ["active", "All active"],
  ["needs_review", "Needs review"],
  ["quote_requested", "Awaiting quote"],
  ["pending_client_approval", "Awaiting client approval"],
  ["approved_to_proceed", "Ready to dispatch"],
  ["in_progress", "In progress"],
  ["ready_to_invoice", "Ready to invoice"],
  ["awaiting_payment", "Awaiting payment"],
  ["paid", "Ready to close"],
  ["terminal", "Terminal"],
] as const satisfies readonly [WorkOrderListView, string][];

export const FINANCE_WORK_ORDER_QUEUE_PRESETS: readonly QueuePreset[] = [
  ["ready_to_invoice", "Ready to invoice"],
  ["draft_invoices", "Draft invoice cases"],
  ["issued_invoices", "Invoiced not paid"],
  ["overdue_invoices", "Overdue invoices"],
  ["paid", "Paid ready for close"],
] as const;

export function QueuePresets({
  role,
  activeView,
  presets = WORK_ORDER_QUEUE_PRESETS,
  basePath = "/work-orders",
  queryKey = "view",
}: {
  role: InternalUserRole;
  activeView?: string | null;
  presets?: readonly QueuePreset[];
  basePath?: string;
  queryKey?: "view" | "queue";
}) {
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Work order queues">
      {presets.map(([view, label]) => {
        const active = activeView === view;
        const href = `${basePath}?role=${role}&${queryKey}=${view}`;

        return (
          <Link
            key={view}
            href={href}
            className={
              active
                ? "rounded-md bg-neutral-950 px-3 py-2 text-sm font-semibold text-white"
                : "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 hover:border-neutral-500"
            }
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
