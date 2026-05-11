"use client";

import { formatWorkOrderFilesTabLabel } from "./work-order-files-model";

export type WorkOrderTabId =
  | "overview"
  | "workflow"
  | "quotes-finance"
  | "communications"
  | "files"
  | "history-audit";

interface WorkOrderTabsProps {
  activeTab: WorkOrderTabId;
  attachmentCount: number;
  onChange: (tabId: WorkOrderTabId) => void;
}

export function WorkOrderTabs({
  activeTab,
  attachmentCount,
  onChange,
}: WorkOrderTabsProps) {
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "workflow", label: "Workflow" },
    { id: "quotes-finance", label: "Quotes & Finance" },
    { id: "communications", label: "Communications" },
    { id: "files", label: formatWorkOrderFilesTabLabel(attachmentCount) },
    { id: "history-audit", label: "History / Audit" },
  ] as const satisfies ReadonlyArray<{ id: WorkOrderTabId; label: string }>;

  return (
    <div className="overflow-x-auto">
      <div
        aria-label="Work order sections"
        className="inline-flex min-w-full gap-1.5 border-b border-neutral-200 pb-1"
        role="tablist"
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;

          return (
            <button
              aria-controls={`work-order-panel-${tab.id}`}
              aria-selected={isActive}
              className={
                isActive
                  ? "inline-flex min-w-max items-center justify-center rounded-lg border border-neutral-950 bg-neutral-950 px-3 py-2 text-sm font-semibold text-white"
                  : "inline-flex min-w-max items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-950"
              }
              id={`work-order-tab-${tab.id}`}
              key={tab.id}
              onClick={() => onChange(tab.id)}
              role="tab"
              type="button"
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
