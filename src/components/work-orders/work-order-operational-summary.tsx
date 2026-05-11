import { WorkOrderCompactRow } from "./work-order-compact-row";
import { WorkOrderSection } from "./work-order-section";
import { WorkOrderSectionHeader } from "./work-order-section-header";

interface WorkOrderOperationalSummaryProps {
  categoryLabel: string;
  createdAtLabel: string;
  description: string;
  dueDateLabel: string;
  lastUpdatedLabel: string;
  priorityLabel: string;
  quoteRequirementLabel: string;
  statusLabel: string;
  title: string;
}

export function WorkOrderOperationalSummary({
  categoryLabel,
  createdAtLabel,
  description,
  dueDateLabel,
  lastUpdatedLabel,
  priorityLabel,
  quoteRequirementLabel,
  statusLabel,
  title,
}: WorkOrderOperationalSummaryProps) {
  return (
    <WorkOrderSection>
      <WorkOrderSectionHeader
        description="Snapshot of the current work, priority, and delivery expectations."
        title="Operational Summary"
      />

      <div className="mt-4 border-l-2 border-neutral-200 pl-4">
        <p className="text-sm font-semibold text-neutral-950">{title}</p>
        <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
          {description}
        </p>
      </div>

      <dl className="mt-4 grid gap-x-5 gap-y-1 border-t border-neutral-200 pt-3 sm:grid-cols-2">
        <Metric label="Status" value={statusLabel} />
        <Metric label="Priority" value={priorityLabel} />
        <Metric label="Category" value={categoryLabel} />
        <Metric label="Quote required" value={quoteRequirementLabel} />
        <Metric label="Due date" value={dueDateLabel} />
        <Metric label="Created" value={createdAtLabel} />
        <Metric label="Last updated" value={lastUpdatedLabel} />
      </dl>
    </WorkOrderSection>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <WorkOrderCompactRow label={label} value={value} />;
}
