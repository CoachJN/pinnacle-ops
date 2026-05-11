import type { DerivedWorkOrderOperationalSummary } from "./work-order-display-model";
import { WorkOrderCompactRow } from "./work-order-compact-row";

interface WorkOrderNextActionPanelProps {
  summary: DerivedWorkOrderOperationalSummary;
}

export function WorkOrderNextActionPanel({
  summary,
}: WorkOrderNextActionPanelProps) {
  return (
    <section className="border border-neutral-200 bg-[linear-gradient(135deg,#111827,#1f2937)] px-4 py-4 text-white sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-neutral-300">
            Next Action
          </p>
          <h2 className="mt-1.5 text-xl font-semibold tracking-tight sm:text-2xl">
            {summary.nextAction.label}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-5 text-neutral-200">
            {summary.nextAction.detail}
          </p>
        </div>

        <dl className="grid min-w-0 gap-x-5 gap-y-1 border-t border-white/10 pt-3 text-white sm:grid-cols-3 lg:min-w-[24rem] lg:border-t-0 lg:pt-0">
          <Metric label="Age" value={summary.ageLabel} />
          <Metric label="Risk" value={summary.riskLabel ?? "No active risk"} />
          <Metric
            label="Ownership"
            value={summary.ownershipWarning ?? "Covered"}
          />
        </dl>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <WorkOrderCompactRow
      label={label}
      value={<span className="font-medium text-white">{value}</span>}
    />
  );
}
