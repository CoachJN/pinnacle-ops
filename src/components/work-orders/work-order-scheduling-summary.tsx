"use client";

import { formatDate, formatDateTime } from "./formatting";
import { WorkOrderCompactRow } from "./work-order-compact-row";
import { WorkOrderSection } from "./work-order-section";
import { WorkOrderSectionHeader } from "./work-order-section-header";
import type { WorkflowSchedulingSummary } from "./work-order-workflow-model";

interface WorkOrderSchedulingSummaryProps {
  model: WorkflowSchedulingSummary;
}

export function WorkOrderSchedulingSummary({
  model,
}: WorkOrderSchedulingSummaryProps) {
  return (
    <WorkOrderSection id="workflow-scheduling">
      <WorkOrderSectionHeader
        description="Requested, due, and scheduled timing pulled from the work order and its active contractor assignment."
        title="Scheduling Snapshot"
      />

      <dl className="mt-4 grid gap-x-5 gap-y-1 border-t border-neutral-200 pt-3 sm:grid-cols-2">
        <Metric
          label="Requested service date"
          value={formatDate(model.requestedServiceDate)}
        />
        <Metric label="Due date" value={formatDate(model.dueDate)} />
        <Metric
          label="Scheduled date"
          value={
            model.scheduledDate
              ? formatDate(model.scheduledDate)
              : "Not scheduled yet"
          }
        />
        <Metric
          label="Active assignment status"
          value={
            model.hasActiveAssignment
              ? toTitle(model.schedulingStatusLabel)
              : "No active contractor assignment"
          }
        />
        <Metric
          label="Window start"
          value={
            model.timeWindowStart
              ? formatDateTime(model.timeWindowStart)
              : "Not scheduled yet"
          }
        />
        <Metric
          label="Window end"
          value={
            model.timeWindowEnd
              ? formatDateTime(model.timeWindowEnd)
              : "Not scheduled yet"
          }
        />
      </dl>

      <p className="mt-4 border-l-2 border-neutral-300 bg-neutral-50 px-3 py-2 text-sm text-neutral-600">
        {model.schedulingMessage}
      </p>
    </WorkOrderSection>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <WorkOrderCompactRow label={label} value={value} />;
}

function toTitle(value: string): string {
  return value
    .split(" ")
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(" ");
}
