import { formatDateTime } from "./formatting";
import type { DerivedWorkOrderCommunicationSummary } from "./work-order-communication-model";

interface WorkOrderCommunicationSummaryPanelProps {
  summary: DerivedWorkOrderCommunicationSummary;
}

export function WorkOrderCommunicationSummaryPanel({
  summary,
}: WorkOrderCommunicationSummaryPanelProps) {
  const needsAttention =
    summary.hasGapWarning || summary.status !== "Communication activity is current";

  return (
    <section
      aria-labelledby="work-order-communication-summary-heading"
      className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2
            className="text-lg font-semibold text-neutral-950"
            id="work-order-communication-summary-heading"
          >
            Communication Summary
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            A compact view of recent communication coverage, external visibility, and follow-up
            risk.
          </p>
        </div>
        <span
          className={
            needsAttention
              ? "inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800"
              : "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800"
          }
        >
          {summary.status}
        </span>
      </div>

      <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryMetric
          label="Most recent"
          value={formatDateTime(summary.mostRecentCommunicationAt)}
        />
        <SummaryMetric
          label="Last internal note"
          value={formatDateTime(summary.lastInternalNoteAt)}
        />
        <SummaryMetric
          label="Last client update"
          value={formatDateTime(summary.lastClientVisibleCommunicationAt)}
        />
        <SummaryMetric
          label="Last contractor update"
          value={formatDateTime(summary.lastContractorVisibleCommunicationAt)}
        />
        <SummaryMetric
          label="Total records"
          value={String(summary.totalCommunicationCount)}
        />
      </dl>

      {summary.gapWarning ? (
        <p className="mt-4 rounded-2xl border border-dashed border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {summary.gapWarning}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {summary.guidance.map((item) => (
          <span
            className="inline-flex rounded-full border border-neutral-300 bg-neutral-50 px-3 py-1 text-xs font-medium text-neutral-700"
            key={item}
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

function SummaryMetric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
        {label}
      </dt>
      <dd className="mt-2 text-sm font-medium text-neutral-950">{value}</dd>
    </div>
  );
}
