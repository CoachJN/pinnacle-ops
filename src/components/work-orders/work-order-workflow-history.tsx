"use client";

import { formatDateTime } from "./formatting";
import type { WorkflowHistoryItem } from "./work-order-workflow-model";

interface WorkOrderWorkflowHistoryProps {
  description?: string;
  headingId?: string;
  id?: string;
  items: WorkflowHistoryItem[];
  title?: string;
}

export function WorkOrderWorkflowHistory({
  description = "Lifecycle movement and recent workflow changes are recorded here.",
  headingId = "workflow-history-heading",
  id = "workflow-history",
  items,
  title = "Workflow History",
}: WorkOrderWorkflowHistoryProps) {
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
      id={id}
    >
      <div>
        <h2 className="text-lg font-semibold text-neutral-950" id={headingId}>
          {title}
        </h2>
        <p className="mt-1 text-sm text-neutral-600">{description}</p>
      </div>

      {items.length === 0 ? (
        <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
          No workflow history has been recorded yet.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4"
              key={item.id}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-950">{item.title}</p>
                  <p className="mt-1 text-sm text-neutral-600">{item.detail}</p>
                </div>
                <p className="shrink-0 text-xs text-neutral-500">
                  {formatDateTime(item.occurredAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
