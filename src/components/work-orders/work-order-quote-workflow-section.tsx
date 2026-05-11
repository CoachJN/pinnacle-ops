import { formatInvoiceCurrency } from "@/lib/invoices/money";
import { WORK_ORDER_STATUS_LABELS, type WorkOrderStatus } from "@/modules/work-orders";
import type { WorkOrderFinancialSummary } from "./work-order-financial-model";

export function WorkOrderQuoteWorkflowSection({
  clientQuoteCount,
  contractorQuoteCount,
  quoteRequiredThresholdCents,
  requiresQuote,
  summary,
  workOrderStatus,
}: {
  clientQuoteCount: number;
  contractorQuoteCount: number;
  quoteRequiredThresholdCents: number | null;
  requiresQuote: boolean;
  summary: WorkOrderFinancialSummary;
  workOrderStatus: WorkOrderStatus;
}) {
  return (
    <section
      className="rounded-[1.5rem] border border-neutral-200 bg-white p-5 shadow-sm"
      id="quote-workflow"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-950">Quote workflow</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Internal quote intake and client approval status, organized around the current workflow state.
          </p>
        </div>
        <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-700">
          {summary.currentQuoteWorkflowState}
        </span>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-4">
        <SnapshotCard
          detail={requiresQuote ? "Quote required" : "Quote not required"}
          label="Requirement"
          value={requiresQuote ? "Required" : "Not required"}
        />
        <SnapshotCard
          detail={
            quoteRequiredThresholdCents == null
              ? "No quote threshold has been configured."
              : "Configured threshold for quote workflow."
          }
          label="Threshold"
          value={
            quoteRequiredThresholdCents == null
              ? "Not set"
              : formatInvoiceCurrency(quoteRequiredThresholdCents / 100, "CAD")
          }
        />
        <SnapshotCard
          detail={summary.contractorQuote.detail}
          label="Contractor history"
          value={`${contractorQuoteCount} quote${contractorQuoteCount === 1 ? "" : "s"}`}
        />
        <SnapshotCard
          detail={summary.clientQuote.detail}
          label="Client history"
          value={`${clientQuoteCount} quote${clientQuoteCount === 1 ? "" : "s"}`}
        />
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Current workflow state
          </p>
          <p className="mt-2 text-sm font-semibold text-neutral-950">
            {WORK_ORDER_STATUS_LABELS[workOrderStatus]}
          </p>
          <p className="mt-2 text-sm text-neutral-600">{summary.nextAction.detail}</p>
        </div>
        <div className="rounded-3xl border border-neutral-200 bg-neutral-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Rejection reason
          </p>
          <p className="mt-2 text-sm text-neutral-700">
            {summary.latestRejectionReason ?? "No rejection reason has been recorded."}
          </p>
        </div>
      </div>
    </section>
  );
}

function SnapshotCard({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-neutral-200 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
        {label}
      </p>
      <p className="mt-3 text-sm font-semibold text-neutral-950">{value}</p>
      <p className="mt-2 text-sm text-neutral-600">{detail}</p>
    </div>
  );
}
