"use client";

import { formatDateTime } from "./formatting";
import type { WorkOrderAuditSummary } from "./work-order-audit-model";

export function WorkOrderAuditSummaryPanel({
  summary,
}: {
  summary: WorkOrderAuditSummary;
}) {
  const cards = [
    { label: "Total events", value: summary.totalEvents },
    { label: "Workflow", value: summary.workflowEventCount },
    { label: "Assignment", value: summary.assignmentEventCount },
    { label: "Finance", value: summary.financialEventCount },
    { label: "Communication", value: summary.communicationEventCount },
    { label: "File", value: summary.fileEventCount },
    { label: "System / Other", value: summary.systemEventCount + summary.otherEventCount },
  ];

  return (
    <section
      aria-labelledby="history-audit-summary-heading"
      className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-950" id="history-audit-summary-heading">
            Audit Summary
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Operational traceability coverage across the work order record.
          </p>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
            Most recent event
          </p>
          <p className="mt-1 text-sm font-medium text-neutral-900">
            {summary.mostRecentEventAt
              ? formatDateTime(summary.mostRecentEventAt)
              : "No audit activity yet"}
          </p>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4" key={card.label}>
            <dt className="text-sm text-neutral-600">{card.label}</dt>
            <dd className="mt-2 text-2xl font-semibold tracking-tight text-neutral-950">
              {card.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
