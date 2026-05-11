"use client";

import { useMemo, useState } from "react";
import { formatDateTime } from "./formatting";
import { WorkOrderEmptyState } from "./work-order-empty-state";
import { WorkOrderSection } from "./work-order-section";
import { WorkOrderSectionHeader } from "./work-order-section-header";
import type {
  WorkOrderAuditCategory,
  WorkOrderAuditTimelineEvent,
} from "./work-order-audit-model";

type WorkOrderAuditFilter =
  | "All"
  | "Workflow"
  | "Assignment"
  | "Finance"
  | "Communication"
  | "File"
  | "System";

const FILTERS: WorkOrderAuditFilter[] = [
  "All",
  "Workflow",
  "Assignment",
  "Finance",
  "Communication",
  "File",
  "System",
];

export function WorkOrderAuditTimeline({
  items,
}: {
  items: WorkOrderAuditTimelineEvent[];
}) {
  const [activeFilter, setActiveFilter] = useState<WorkOrderAuditFilter>("All");
  const filteredItems = useMemo(
    () =>
      activeFilter === "All"
        ? items
        : items.filter((item) => item.category === activeFilter),
    [activeFilter, items],
  );
  const visibleItems = filteredItems.slice(0, 25);

  return (
    <WorkOrderSection>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <WorkOrderSectionHeader
          description="Recent cross-functional history across workflow, assignment, finance, communications, files, and system activity."
          title="Unified Audit Timeline"
        />

        <div
          aria-label="Audit category filters"
          className="flex flex-wrap gap-2"
        >
          {FILTERS.map((filter) => (
            <button
              aria-pressed={activeFilter === filter}
              className={
                activeFilter === filter
                  ? "rounded-full border border-neutral-950 bg-neutral-950 px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:border-neutral-400 hover:text-neutral-950"
              }
              key={filter}
              onClick={() => setActiveFilter(filter)}
              type="button"
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      <AuditEventFeed
        emptyMessage="No audit events are available for this filter yet."
        items={visibleItems}
        limited={filteredItems.length > visibleItems.length}
      />
    </WorkOrderSection>
  );
}

export function AuditEventFeed({
  emptyMessage,
  items,
  limited = false,
}: {
  emptyMessage: string;
  items: WorkOrderAuditTimelineEvent[];
  limited?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="mt-4">
        <WorkOrderEmptyState
          message="Select another category or wait for the next event."
          title={emptyMessage}
        />
      </div>
    );
  }

  return (
    <div className="mt-4">
      <ol className="divide-y divide-neutral-200 border-t border-neutral-200">
        {items.map((item) => (
          <li className="py-3" key={item.id}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-neutral-950">
                    {item.eventLabel}
                  </p>
                  <AuditCategoryBadge category={item.category} />
                </div>
                <p className="mt-1 text-sm text-neutral-600">
                  {item.shortDetail}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                  <span>
                    {item.actorLabel
                      ? `Actor: ${item.actorLabel}`
                      : "Actor unknown"}
                  </span>
                  <span>Source: {humanizeSourceType(item.sourceType)}</span>
                </div>
              </div>
              <p className="shrink-0 text-xs text-neutral-500">
                {formatDateTime(item.timestamp)}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {limited ? (
        <p className="mt-3 text-xs text-neutral-500">
          Showing the most recent 25 matching events.
        </p>
      ) : null}
    </div>
  );
}

function AuditCategoryBadge({
  category,
}: {
  category: WorkOrderAuditCategory;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${categoryClassNames[category]}`}
    >
      {category}
    </span>
  );
}

const categoryClassNames: Record<WorkOrderAuditCategory, string> = {
  Workflow: "bg-sky-100 text-sky-800",
  Assignment: "bg-amber-100 text-amber-800",
  Finance: "bg-emerald-100 text-emerald-800",
  Communication: "bg-indigo-100 text-indigo-800",
  File: "bg-stone-200 text-stone-800",
  System: "bg-slate-200 text-slate-800",
  Other: "bg-neutral-200 text-neutral-700",
};

function humanizeSourceType(
  value: WorkOrderAuditTimelineEvent["sourceType"],
): string {
  switch (value) {
    case "client_quote":
      return "client quote";
    case "contractor_quote":
      return "contractor quote";
    case "status_fallback":
      return "current status";
    default:
      return value.replaceAll("_", " ");
  }
}
