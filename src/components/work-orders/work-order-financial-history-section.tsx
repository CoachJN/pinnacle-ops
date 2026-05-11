"use client";

import { AuditEventFeed } from "./work-order-audit-timeline";
import type { WorkOrderAuditTimelineEvent } from "./work-order-audit-model";

export function WorkOrderFinancialHistorySection({
  items,
}: {
  items: WorkOrderAuditTimelineEvent[];
}) {
  return (
    <section
      aria-labelledby="history-audit-financial-heading"
      className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div>
        <h2 className="text-lg font-semibold text-neutral-950" id="history-audit-financial-heading">
          Financial History
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Quote, invoice, approval, and sync-related finance traceability for review.
        </p>
      </div>
      <AuditEventFeed
        emptyMessage="No financial history is attached to this work order yet."
        items={items}
      />
    </section>
  );
}
