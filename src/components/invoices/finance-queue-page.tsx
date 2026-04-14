import Link from "next/link";
import type { FinanceQueueFilter } from "@/modules/finance";
import { FINANCE_QUEUE_FILTERS } from "@/modules/finance";
import { FinanceQueueTable } from "./finance-queue-table";

interface FinanceQueuePageItem {
  id: string;
  state: "ready_for_invoicing" | "draft" | "sent" | "overdue" | "paid";
  requiresAttention: boolean;
  workOrder: {
    id: string;
    workOrderNumber: string;
    title: string;
    status: string;
    clientSnapshot?: {
      name: string;
    } | null;
    locationSnapshot?: {
      name: string;
    } | null;
    updatedAt: string;
  };
  invoice: {
    id: string;
    invoiceNumber: string;
    status: "draft" | "sent" | "viewed" | "overdue" | "paid" | "void" | "issued";
    dueDate: string;
    totalAmount: number;
    currency: "CAD" | "USD";
  } | null;
}

export function FinanceQueuePage({
  counts,
  filter,
  items,
}: {
  counts: Record<FinanceQueueFilter, number>;
  filter: FinanceQueueFilter;
  items: FinanceQueuePageItem[];
}) {
  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-normal text-neutral-500">
            Finance
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-neutral-950">
            Billing operations queue
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-600">
            Completed work, invoice drafts, collections follow-up, and paid closeout all stay in one operational queue.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-7">
        {FINANCE_QUEUE_FILTERS.map((entry) => (
          <Link
            key={entry}
            className={
              entry === filter
                ? "rounded-3xl border border-neutral-950 bg-neutral-950 px-4 py-4 text-white shadow-sm"
                : "rounded-3xl border border-neutral-200 bg-white px-4 py-4 text-neutral-900 shadow-sm"
            }
            href={`/finance?view=${entry}`}
          >
            <p className="text-xs font-semibold uppercase tracking-normal opacity-70">
              {entry.replaceAll("_", " ")}
            </p>
            <p className="mt-2 text-2xl font-semibold">{counts[entry]}</p>
          </Link>
        ))}
      </div>

      <FinanceQueueTable filter={filter} items={items} />
    </section>
  );
}
