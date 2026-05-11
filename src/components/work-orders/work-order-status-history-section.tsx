"use client";

import { AuditEventFeed } from "./work-order-audit-timeline";
import type { WorkOrderAuditTimelineEvent } from "./work-order-audit-model";

export function WorkOrderStatusHistorySection({
  items,
}: {
  items: WorkOrderAuditTimelineEvent[];
}) {
  return (
    <section
      aria-labelledby="history-audit-status-heading"
      className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div>
        <h2 className="text-lg font-semibold text-neutral-950" id="history-audit-status-heading">
          Status / Lifecycle History
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Lifecycle and workflow movement recorded for this work order.
        </p>
      </div>
      <AuditEventFeed
        emptyMessage="No status or lifecycle history is available yet."
        items={items}
      />
    </section>
  );
}
