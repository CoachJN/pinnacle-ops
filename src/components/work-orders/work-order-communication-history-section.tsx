"use client";

import { AuditEventFeed } from "./work-order-audit-timeline";
import type { WorkOrderAuditTimelineEvent } from "./work-order-audit-model";

export function WorkOrderCommunicationHistorySection({
  items,
}: {
  items: WorkOrderAuditTimelineEvent[];
}) {
  return (
    <section
      aria-labelledby="history-audit-communication-heading"
      className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div>
        <h2
          className="text-lg font-semibold text-neutral-950"
          id="history-audit-communication-heading"
        >
          Communication / Notes History
        </h2>
        <p className="mt-1 text-sm text-neutral-600">
          Messages, internal notes, and communication-facing timeline records.
        </p>
      </div>
      <AuditEventFeed
        emptyMessage="No communication or note history is available yet."
        items={items}
      />
    </section>
  );
}
