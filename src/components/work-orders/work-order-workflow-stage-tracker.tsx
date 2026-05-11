"use client";

import { WorkOrderSection } from "./work-order-section";
import { WorkOrderSectionHeader } from "./work-order-section-header";
import { WorkOrderStatusPill } from "./work-order-status-pill";
import type { DerivedWorkOrderWorkflowStage } from "./work-order-workflow-model";

interface WorkOrderWorkflowStageTrackerProps {
  model: DerivedWorkOrderWorkflowStage;
}

export function WorkOrderWorkflowStageTracker({
  model,
}: WorkOrderWorkflowStageTrackerProps) {
  return (
    <WorkOrderSection id="workflow-stage-tracker">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <WorkOrderSectionHeader
          description="This display maps the canonical lifecycle status into a simplified execution view for operators. Backend status and transition rules remain the source of truth."
          title="Workflow Stage Tracker"
        />
        <div className="flex flex-wrap gap-2">
          <WorkOrderStatusPill tone={model.isException ? "critical" : "muted"}>
            {`Current: ${model.currentStageLabel}`}
          </WorkOrderStatusPill>
          <WorkOrderStatusPill>{`Backend status: ${model.statusLabel}`}</WorkOrderStatusPill>
        </div>
      </div>

      <ol className="mt-4 grid gap-2 border-t border-neutral-200 pt-3 md:grid-cols-2 xl:grid-cols-4">
        {model.stages.map((stage, index) => (
          <li className={getStageClassName(stage.state)} key={stage.id}>
            <div className="flex items-start gap-3">
              <span className={getStageIndexClassName(stage.state)}>
                {index + 1}
              </span>
              <div className="min-w-0">
                <p className={getStageLabelClassName(stage.state)}>
                  {stage.label}
                </p>
                <p className={getStageStateClassName(stage.state)}>
                  {getStageStateLabel(stage.state)}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>

      {model.isFallback ? (
        <p className="mt-4 border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This status does not match the current display mapping yet. The raw
          backend status is still shown above so workflow actions remain usable.
        </p>
      ) : null}
    </WorkOrderSection>
  );
}

function getStageClassName(
  state: "completed" | "current" | "upcoming" | "blocked",
): string {
  if (state === "completed") {
    return "border border-emerald-200 bg-emerald-50 px-3 py-3";
  }

  if (state === "current") {
    return "border border-neutral-900 bg-neutral-950 px-3 py-3 text-white";
  }

  if (state === "blocked") {
    return "border border-rose-200 bg-rose-50 px-3 py-3";
  }

  return "border border-neutral-200 bg-neutral-50 px-3 py-3";
}

function getStageIndexClassName(
  state: "completed" | "current" | "upcoming" | "blocked",
): string {
  if (state === "completed") {
    return "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-emerald-300 bg-white text-sm font-semibold text-emerald-700";
  }

  if (state === "current") {
    return "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-semibold text-white";
  }

  if (state === "blocked") {
    return "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rose-300 bg-white text-sm font-semibold text-rose-700";
  }

  return "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white text-sm font-semibold text-neutral-600";
}

function getStageLabelClassName(
  state: "completed" | "current" | "upcoming" | "blocked",
): string {
  return state === "current"
    ? "text-sm font-semibold text-white"
    : "text-sm font-semibold text-neutral-950";
}

function getStageStateClassName(
  state: "completed" | "current" | "upcoming" | "blocked",
): string {
  return state === "current"
    ? "mt-1 text-xs font-medium uppercase tracking-[0.18em] text-white/75"
    : "mt-1 text-xs font-medium uppercase tracking-[0.18em] text-neutral-500";
}

function getStageStateLabel(
  state: "completed" | "current" | "upcoming" | "blocked",
): string {
  if (state === "completed") {
    return "Completed";
  }

  if (state === "current") {
    return "Current";
  }

  if (state === "blocked") {
    return "Blocked";
  }

  return "Upcoming";
}
