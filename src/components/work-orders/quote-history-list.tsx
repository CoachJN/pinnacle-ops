import Link from "next/link";
import type { InternalUserRole } from "@/types/permissions";
import type { Quote } from "@/types/quote";
import type { PhaseOneWorkOrder } from "@/types/work-order";
import { canEditQuote } from "@/lib/permissions/quote-permissions";
import { formatCurrency } from "@/lib/quotes/money";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { formatDateTime } from "./formatting";

export function QuoteHistoryList({
  workOrder,
  quotes,
  role,
}: {
  workOrder: PhaseOneWorkOrder;
  quotes: Quote[];
  role: InternalUserRole;
}) {
  if (quotes.length === 0) {
    return (
      <p className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
        No quote history is attached to this work order yet.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-neutral-200 text-sm">
          <thead className="bg-neutral-100 text-left text-xs font-semibold uppercase tracking-normal text-neutral-600">
            <tr>
              <th className="px-4 py-3">Version</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Contractor</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {quotes.map((quote) => {
              const current = workOrder.currentQuoteId === quote.id;
              return (
                <tr key={quote.id} className={current ? "bg-teal-50/40" : ""}>
                  <td className="px-4 py-3 font-semibold text-neutral-950">
                    v{quote.versionNumber}
                    {current ? (
                      <span className="ml-2 text-xs font-medium text-teal-800">
                        Current
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    <QuoteStatusBadge status={quote.status} />
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {quote.contractorName}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {formatCurrency(quote.totalAmount)}
                  </td>
                  <td className="px-4 py-3 text-neutral-700">
                    {quote.submittedAt ? formatDateTime(quote.submittedAt) : "Not submitted"}
                  </td>
                  <td className="px-4 py-3">
                    {canEditQuote(role, workOrder, quote) ? (
                      <Link
                        className="font-semibold text-neutral-950 underline-offset-4 hover:underline"
                        href={`/work-orders/${workOrder.id}/quotes/${quote.id}/edit?role=${role}`}
                      >
                        Edit draft
                      </Link>
                    ) : (
                      <span className="text-neutral-500">History</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
