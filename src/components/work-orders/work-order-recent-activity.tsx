"use client";

import type { WorkOrderTabId } from "./work-order-tabs";
import { formatDateTime } from "./formatting";
import type { RecentActivityItem } from "./work-order-display-model";

interface WorkOrderRecentActivityProps {
  items: RecentActivityItem[];
  onOpenTab: (tabId: WorkOrderTabId) => void;
}

export function WorkOrderRecentActivity({
  items,
  onOpenTab,
}: WorkOrderRecentActivityProps) {
  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-neutral-950">Recent Activity Snapshot</h2>
          <p className="mt-1 text-sm text-neutral-600">
            Most recent operational movement across the available work-order records.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            label="Open Files"
            onClick={() => onOpenTab("files")}
          />
          <ActionButton
            label="Open History / Audit"
            onClick={() => onOpenTab("history-audit")}
          />
          <ActionButton
            label="Open Communications"
            onClick={() => onOpenTab("communications")}
          />
        </div>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-4 py-4 text-sm text-neutral-600">
          No recent activity has been recorded yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-neutral-950">{item.title}</p>
                  <p className="mt-1 text-sm text-neutral-600">{item.detail}</p>
                </div>
                <button
                  className="text-left text-xs font-medium text-neutral-500 underline-offset-4 hover:text-neutral-900 hover:underline"
                  onClick={() => onOpenTab(item.targetTab)}
                  type="button"
                >
                  {formatDateTime(item.occurredAt)}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className="inline-flex items-center justify-center rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm font-semibold text-neutral-700 transition hover:border-neutral-500 hover:text-neutral-950"
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}
