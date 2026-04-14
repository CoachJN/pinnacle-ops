import type { QuoteStatus } from "@/types/quote";
import { QUOTE_STATUS_LABELS } from "@/lib/quotes/status";
import { cn } from "@/lib/utils";

const statusClassName = {
  draft: "border-neutral-300 bg-neutral-100 text-neutral-700",
  submitted: "border-teal-200 bg-teal-50 text-teal-800",
  under_review: "border-indigo-200 bg-indigo-50 text-indigo-800",
  ready_for_client: "border-amber-200 bg-amber-50 text-amber-900",
  client_approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  client_rejected: "border-rose-200 bg-rose-50 text-rose-800",
  superseded: "border-neutral-300 bg-white text-neutral-600",
} as const satisfies Record<QuoteStatus, string>;

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold",
        statusClassName[status],
      )}
    >
      {QUOTE_STATUS_LABELS[status]}
    </span>
  );
}
