import type { InvoiceStatus } from "@/types/invoice";
import { INVOICE_STATUS_LABELS } from "@/lib/invoices/status";
import { cn } from "@/lib/utils";

const invoiceStatusClassName = {
  draft: "border-neutral-300 bg-neutral-100 text-neutral-700",
  issued: "border-sky-200 bg-sky-50 text-sky-800",
  sent: "border-sky-200 bg-sky-50 text-sky-800",
  viewed: "border-indigo-200 bg-indigo-50 text-indigo-800",
  overdue: "border-rose-200 bg-rose-50 text-rose-800",
  paid: "border-lime-200 bg-lime-50 text-lime-800",
  void: "border-zinc-300 bg-zinc-100 text-zinc-700",
} as const satisfies Record<InvoiceStatus, string>;

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold",
        invoiceStatusClassName[status],
      )}
    >
      {INVOICE_STATUS_LABELS[status]}
    </span>
  );
}
