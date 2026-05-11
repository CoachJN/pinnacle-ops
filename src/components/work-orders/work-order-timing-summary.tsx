import { WorkOrderCompactRow } from "./work-order-compact-row";
import { WorkOrderSection } from "./work-order-section";
import { WorkOrderSectionHeader } from "./work-order-section-header";
import { WorkOrderStatusPill } from "./work-order-status-pill";

interface WorkOrderTimingSummaryProps {
  ageLabel: string;
  closedAtLabel: string;
  createdAtLabel: string;
  dueDateLabel: string;
  isOverdue: boolean;
  requestedServiceDateLabel: string;
  updatedAtLabel: string;
}

export function WorkOrderTimingSummary({
  ageLabel,
  closedAtLabel,
  createdAtLabel,
  dueDateLabel,
  isOverdue,
  requestedServiceDateLabel,
  updatedAtLabel,
}: WorkOrderTimingSummaryProps) {
  return (
    <WorkOrderSection>
      <WorkOrderSectionHeader
        action={
          isOverdue ? (
            <WorkOrderStatusPill tone="critical">Overdue</WorkOrderStatusPill>
          ) : null
        }
        description="Current timing context based on available requested, due, and completion dates."
        title="Operational Timing"
      />

      <dl className="mt-4 grid gap-x-5 gap-y-1 border-t border-neutral-200 pt-3 sm:grid-cols-2">
        <Metric label="Created" value={createdAtLabel} />
        <Metric label="Last updated" value={updatedAtLabel} />
        <Metric label="Requested service" value={requestedServiceDateLabel} />
        <Metric label="Due date" value={dueDateLabel} />
        <Metric label="Closed" value={closedAtLabel} />
        <Metric label="Age" value={ageLabel} />
      </dl>
    </WorkOrderSection>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <WorkOrderCompactRow label={label} value={value} />;
}
