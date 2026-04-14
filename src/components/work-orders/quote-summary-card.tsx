import type { Quote } from "@/types/quote";
import { formatCurrency } from "@/lib/quotes/money";
import { QuoteStatusBadge } from "@/components/quotes/quote-status-badge";
import { formatDateTime } from "./formatting";

export function QuoteSummaryCard({ quote }: { quote: Quote | null }) {
  if (!quote) {
    return (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-sm font-semibold text-neutral-950">No active quote</p>
        <p className="mt-1 text-sm text-neutral-600">
          Quote totals and decision state will appear after a quote draft is created.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-neutral-950">
            Quote version {quote.versionNumber}
          </p>
          <p className="mt-1 text-sm text-neutral-600">
            {quote.contractorName}
          </p>
        </div>
        <QuoteStatusBadge status={quote.status} />
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
        <Amount label="Labor" amount={quote.laborAmount} />
        <Amount label="Materials" amount={quote.materialAmount} />
        <Amount label="Other" amount={quote.otherAmount} />
        <Amount label="Total" amount={quote.totalAmount} strong />
      </dl>
      <p className="mt-4 text-sm text-neutral-700">{quote.scopeSummary}</p>
      <p className="mt-3 text-xs text-neutral-500">
        Updated {formatDateTime(quote.updatedAt)}
      </p>
    </div>
  );
}

function Amount({
  label,
  amount,
  strong = false,
}: {
  label: string;
  amount: number;
  strong?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-normal text-neutral-500">
        {label}
      </dt>
      <dd
        className={
          strong
            ? "mt-1 text-base font-semibold text-neutral-950"
            : "mt-1 font-medium text-neutral-800"
        }
      >
        {formatCurrency(amount)}
      </dd>
    </div>
  );
}
