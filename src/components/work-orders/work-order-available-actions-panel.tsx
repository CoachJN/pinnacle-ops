"use client";

import { ActionFeedback } from "@/components/shared/action-feedback";
import type { WorkOrderStatus } from "@/modules/work-orders";
import { WorkOrderEmptyState } from "./work-order-empty-state";
import { WorkOrderSection } from "./work-order-section";
import { WorkOrderSectionHeader } from "./work-order-section-header";
import type {
  DerivedWorkflowActions,
  WorkflowActionItem,
} from "./work-order-workflow-model";

interface WorkOrderAvailableActionsPanelProps {
  isUpdatingStatus: boolean;
  model: DerivedWorkflowActions;
  onStatusChange: (nextStatus: WorkOrderStatus) => void;
  pendingStatus: WorkOrderStatus | null;
  statusMessage: string | null;
  statusTone: "success" | "error" | "info";
}

export function WorkOrderAvailableActionsPanel({
  isUpdatingStatus,
  model,
  onStatusChange,
  pendingStatus,
  statusMessage,
  statusTone,
}: WorkOrderAvailableActionsPanelProps) {
  const hasActions = model.all.length > 0;

  return (
    <WorkOrderSection id="workflow-available-actions">
      <WorkOrderSectionHeader
        description="These actions come directly from the current backend-allowed transitions for this work order."
        title="Available Actions"
      />

      {statusMessage ? (
        <div className="mt-4">
          <ActionFeedback message={statusMessage} tone={statusTone} />
        </div>
      ) : null}

      {!hasActions ? (
        <div className="mt-4">
          <WorkOrderEmptyState
            message="The current workflow state does not expose any status actions right now."
            title="No actions currently available"
          />
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {model.primary.length > 0 ? (
            <ActionGroup
              actions={model.primary}
              isUpdatingStatus={isUpdatingStatus}
              onStatusChange={onStatusChange}
              pendingStatus={pendingStatus}
              title="Workflow actions"
              tone="primary"
            />
          ) : null}

          {model.exception.length > 0 ? (
            <ActionGroup
              actions={model.exception}
              isUpdatingStatus={isUpdatingStatus}
              onStatusChange={onStatusChange}
              pendingStatus={pendingStatus}
              title="Operational exceptions"
              tone="exception"
            />
          ) : null}

          {model.terminal.length > 0 ? (
            <ActionGroup
              actions={model.terminal}
              isUpdatingStatus={isUpdatingStatus}
              onStatusChange={onStatusChange}
              pendingStatus={pendingStatus}
              title="Closeout"
              tone="terminal"
            />
          ) : null}

          {model.destructive.length > 0 ? (
            <ActionGroup
              actions={model.destructive}
              isUpdatingStatus={isUpdatingStatus}
              onStatusChange={onStatusChange}
              pendingStatus={pendingStatus}
              title="Destructive actions"
              tone="destructive"
            />
          ) : null}
        </div>
      )}
    </WorkOrderSection>
  );
}

function ActionGroup({
  actions,
  isUpdatingStatus,
  onStatusChange,
  pendingStatus,
  title,
  tone,
}: {
  actions: WorkflowActionItem[];
  isUpdatingStatus: boolean;
  onStatusChange: (nextStatus: WorkOrderStatus) => void;
  pendingStatus: WorkOrderStatus | null;
  title: string;
  tone: "primary" | "exception" | "terminal" | "destructive";
}) {
  return (
    <section className={getGroupClassName(tone)}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-600">
          {title}
        </h3>
      </div>
      <div className="grid gap-2">
        {actions.map((action) => (
          <div
            className="border border-white/70 bg-white/90 px-3 py-3"
            key={action.status}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-neutral-950">
                  {action.label}
                </p>
                <p className="mt-1 text-sm text-neutral-600">{action.detail}</p>
              </div>
              <button
                aria-busy={pendingStatus === action.status}
                className={getButtonClassName(tone)}
                disabled={isUpdatingStatus}
                onClick={() => onStatusChange(action.status)}
                type="button"
              >
                {pendingStatus === action.status ? "Updating..." : "Run action"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function getGroupClassName(
  tone: "primary" | "exception" | "terminal" | "destructive",
): string {
  if (tone === "exception") {
    return "border border-amber-200 bg-amber-50/70 px-3 py-3";
  }

  if (tone === "terminal") {
    return "border border-sky-200 bg-sky-50/70 px-3 py-3";
  }

  if (tone === "destructive") {
    return "border border-rose-200 bg-rose-50/70 px-3 py-3";
  }

  return "border border-neutral-200 bg-neutral-50/80 px-3 py-3";
}

function getButtonClassName(
  tone: "primary" | "exception" | "terminal" | "destructive",
): string {
  if (tone === "exception") {
    return "inline-flex shrink-0 items-center justify-center rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-semibold text-amber-900 transition hover:border-amber-500 disabled:cursor-not-allowed disabled:opacity-60";
  }

  if (tone === "terminal") {
    return "inline-flex shrink-0 items-center justify-center rounded-xl border border-sky-300 bg-white px-4 py-2.5 text-sm font-semibold text-sky-900 transition hover:border-sky-500 disabled:cursor-not-allowed disabled:opacity-60";
  }

  if (tone === "destructive") {
    return "inline-flex shrink-0 items-center justify-center rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-800 transition hover:border-rose-500 disabled:cursor-not-allowed disabled:opacity-60";
  }

  return "inline-flex shrink-0 items-center justify-center rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-400";
}
