"use client";

import { AuditEventFeed } from "./work-order-audit-timeline";
import type { WorkOrderAuditTimelineEvent } from "./work-order-audit-model";

export function WorkOrderSystemEventsSection({
  items,
}: {
  items: WorkOrderAuditTimelineEvent[];
}) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <details>
        <summary className="cursor-pointer list-none">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-neutral-950">System Events / Raw Timeline</h2>
              <p className="mt-1 text-sm text-neutral-600">
                Lower-level timeline records, automation traces, and unknown event types.
              </p>
            </div>
            <span className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold text-neutral-600">
              {items.length} events
            </span>
          </div>
        </summary>
        <AuditEventFeed
          emptyMessage="No lower-level system or raw timeline events are available yet."
          items={items}
        />
      </details>
    </section>
  );
}
