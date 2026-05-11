"use client";

import { useDeferredValue, useState } from "react";
import { formatDateTime } from "./formatting";
import { WorkOrderEmptyState } from "./work-order-empty-state";
import { WorkOrderSection } from "./work-order-section";
import { WorkOrderSectionHeader } from "./work-order-section-header";
import {
  filterWorkOrderCommunicationItems,
  type CommunicationVisibilityAudience,
  type DerivedWorkOrderCommunicationItem,
} from "./work-order-communication-model";

interface WorkOrderCommunicationTimelineProps {
  items: DerivedWorkOrderCommunicationItem[];
}

const FILTERS: CommunicationVisibilityAudience[] = [
  "all",
  "internal",
  "client",
  "contractor",
  "system",
];

export function WorkOrderCommunicationTimeline({
  items,
}: WorkOrderCommunicationTimelineProps) {
  const [filter, setFilter] = useState<CommunicationVisibilityAudience>("all");
  const deferredFilter = useDeferredValue(filter);
  const visibleItems = filterWorkOrderCommunicationItems(
    items,
    deferredFilter,
  ).slice(0, 10);

  return (
    <WorkOrderSection>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <WorkOrderSectionHeader
          description="Recent communication, notes, attachments, and system events in one scannable view."
          title="Communication Timeline"
        />
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((item) => (
            <button
              className={
                item === filter
                  ? "inline-flex rounded-full border border-neutral-900 bg-neutral-950 px-3 py-1 text-xs font-semibold text-white"
                  : "inline-flex rounded-full border border-neutral-300 bg-white px-3 py-1 text-xs font-semibold text-neutral-700"
              }
              key={item}
              onClick={() => setFilter(item)}
              type="button"
            >
              {item === "all" ? "All" : capitalize(item)}
            </button>
          ))}
        </div>
      </div>

      {visibleItems.length === 0 ? (
        <div className="mt-4">
          <WorkOrderEmptyState
            message="Try a different filter or add the first communication for this audience."
            title="No communication records match this filter yet"
          />
        </div>
      ) : (
        <ol className="mt-4 divide-y divide-neutral-200 border-t border-neutral-200">
          {visibleItems.map((item) => (
            <li className="py-3" key={item.id}>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={toneClassName(item.audience)}>
                      {item.badgeLabel}
                    </span>
                    <p className="text-sm font-semibold text-neutral-950">
                      {item.title}
                    </p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-3 text-xs font-medium text-neutral-500">
                    <span>{item.sourceLabel}</span>
                    <span>{item.detail}</span>
                  </div>
                  {item.body ? (
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-neutral-800">
                      {item.body}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-neutral-500">
                    <span>{item.actorLabel}</span>
                    {item.actorDetail ? <span>{item.actorDetail}</span> : null}
                    {item.attachmentCount > 0 ? (
                      <span>
                        {item.attachmentCount} attachment
                        {item.attachmentCount === 1 ? "" : "s"}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="shrink-0 text-xs text-neutral-500">
                  {formatDateTime(item.occurredAt)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </WorkOrderSection>
  );
}

function toneClassName(
  audience: DerivedWorkOrderCommunicationItem["audience"],
): string {
  switch (audience) {
    case "client":
      return "inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-800";
    case "contractor":
      return "inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-orange-800";
    case "system":
      return "inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-800";
    case "internal":
      return "inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800";
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
