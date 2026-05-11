import { WorkOrderCompactRow } from "./work-order-compact-row";
import { WorkOrderSection } from "./work-order-section";
import { WorkOrderSectionHeader } from "./work-order-section-header";

interface WorkOrderOwnershipSummaryProps {
  activeAssignmentStatusLabel: string;
  assignedContractorLabel: string;
  coordinatorLabel: string;
  managerLabel: string;
  ownershipWarning: string | null;
}

export function WorkOrderOwnershipSummary({
  activeAssignmentStatusLabel,
  assignedContractorLabel,
  coordinatorLabel,
  managerLabel,
  ownershipWarning,
}: WorkOrderOwnershipSummaryProps) {
  return (
    <WorkOrderSection>
      <WorkOrderSectionHeader
        description="Read-only ownership coverage. Editing stays in the Workflow tab."
        title="Ownership Snapshot"
      />

      {ownershipWarning ? (
        <div className="mt-4 border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {ownershipWarning}
        </div>
      ) : null}

      <dl className="mt-4 grid gap-x-5 gap-y-1 border-t border-neutral-200 pt-3 sm:grid-cols-2">
        <Metric label="Coordinator" value={coordinatorLabel} />
        <Metric label="Manager" value={managerLabel} />
        <Metric label="Contractor assignment" value={assignedContractorLabel} />
        <Metric
          label="Current contractor reference"
          value={activeAssignmentStatusLabel}
        />
      </dl>
    </WorkOrderSection>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <WorkOrderCompactRow label={label} value={value} />;
}
