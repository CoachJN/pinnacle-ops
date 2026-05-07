import Link from "next/link";
import type { FinanceQueueFilter } from "@/modules/finance";
import type { InvoiceStatus } from "@/types/invoice";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { formatInvoiceCurrency } from "@/lib/invoices/money";
import { formatDate, formatDateTime } from "@/components/work-orders/formatting";

interface FinanceQueueTableItem {
  id: string;
  state: "ready_for_invoicing" | "draft" | "sent" | "overdue" | "paid";
  requiresAttention: boolean;
  workOrder: {
    id: string;
    workOrderNumber: string;
    title: string;
    lifecycleStatus: string;
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
    status: InvoiceStatus;
    dueDate: string;
    totalAmount: number;
    currency: "CAD" | "USD";
  } | null;
}

export function FinanceQueueTable({
  filter,
  items,
}: {
  filter: FinanceQueueFilter;
  items: FinanceQueueTableItem[];
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-10 text-sm text-neutral-600">
        No finance items match the current queue.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-100 text-left text-xs font-semibold uppercase tracking-normal text-neutral-600">
            <tr>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Work order</th>
              <th className="px-4 py-3">Client</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Invoice</th>
              <th className="px-4 py-3">Due / Updated</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200 bg-white">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-stone-50">
                <td className="px-4 py-3">
                  <StateBadge requiresAttention={item.requiresAttention} state={item.state} />
                </td>
                <td className="px-4 py-3">
                  <Link
                    className="font-semibold text-neutral-950 underline-offset-4 hover:underline"
                    href={`/dashboard/work-orders/${item.workOrder.id}`}
                  >
                    {item.workOrder.workOrderNumber}
                  </Link>
                  <p className="mt-1 max-w-xs text-neutral-600">{item.workOrder.title}</p>
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {item.workOrder.clientSnapshot?.name ?? "Unknown client"}
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {item.workOrder.locationSnapshot?.name ?? "Unknown location"}
                </td>
                <td className="px-4 py-3">
                  {item.invoice ? (
                    <div className="space-y-2">
                      <Link
                        className="inline-flex font-semibold text-neutral-950 underline-offset-4 hover:underline"
                        href={`/dashboard/work-orders/${item.workOrder.id}/invoice/${item.invoice.id}`}
                      >
                        {item.invoice.invoiceNumber}
                      </Link>
                      <div>
                        <InvoiceStatusBadge status={item.invoice.status} />
                      </div>
                      <p className="text-neutral-700">
                        {formatInvoiceCurrency(
                          item.invoice.totalAmount,
                          item.invoice.currency,
                        )}
                      </p>
                    </div>
                  ) : (
                    <span className="text-neutral-500">Not created</span>
                  )}
                </td>
                <td className="px-4 py-3 text-neutral-700">
                  {item.invoice ? (
                    <>
                      <div>{formatDate(item.invoice.dueDate)}</div>
                      <div className="mt-1 text-xs text-neutral-500">
                        Updated {formatDateTime(item.workOrder.updatedAt)}
                      </div>
                    </>
                  ) : (
                    <>
                      <div>Ready now</div>
                      <div className="mt-1 text-xs text-neutral-500">
                        Updated {formatDateTime(item.workOrder.updatedAt)}
                      </div>
                    </>
                  )}
                </td>
                <td className="px-4 py-3">
                  <Link
                    className="inline-flex rounded-xl border border-neutral-300 bg-white px-3 py-2 font-semibold text-neutral-700 hover:border-neutral-500"
                    href={buildActionHref(item)}
                  >
                    {buildActionLabel(item, filter)}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function buildActionHref(item: FinanceQueueTableItem): string {
  if (item.state === "ready_for_invoicing") {
    return `/dashboard/work-orders/${item.workOrder.id}/invoice/new`;
  }

  if (item.state === "draft" && item.invoice) {
    return `/dashboard/work-orders/${item.workOrder.id}/invoice/${item.invoice.id}/edit`;
  }

  if (item.invoice) {
    return `/dashboard/work-orders/${item.workOrder.id}/invoice/${item.invoice.id}`;
  }

  return `/dashboard/work-orders/${item.workOrder.id}`;
}

function buildActionLabel(
  item: FinanceQueueTableItem,
  filter: FinanceQueueFilter,
): string {
  void filter;
  if (item.state === "ready_for_invoicing") {
    return "Create invoice";
  }

  if (item.state === "draft") {
    return "Edit draft";
  }

  if (item.state === "paid") {
    return "Review payment";
  }

  return "Open invoice";
}

function StateBadge({
  requiresAttention,
  state,
}: {
  requiresAttention: boolean;
  state: FinanceQueueTableItem["state"];
}) {
  const label =
    state === "ready_for_invoicing"
      ? "Ready"
      : state === "draft"
        ? "Draft"
        : state === "sent"
          ? "Sent"
          : state === "overdue"
            ? "Overdue"
            : "Paid";

  return (
    <span
      className={
        requiresAttention
          ? "inline-flex rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"
          : "inline-flex rounded-md border border-neutral-300 bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700"
      }
    >
      {label}
    </span>
  );
}
