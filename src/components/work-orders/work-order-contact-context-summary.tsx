import { WorkOrderCompactRow } from "./work-order-compact-row";
import { WorkOrderSection } from "./work-order-section";
import { WorkOrderSectionHeader } from "./work-order-section-header";

interface WorkOrderContactContextSummaryProps {
  clientDisplayName: string;
  locationName: string;
  requesterEmail: string | null;
  requesterName: string;
  requesterPhone: string | null;
}

export function WorkOrderContactContextSummary({
  clientDisplayName,
  locationName,
  requesterEmail,
  requesterName,
  requesterPhone,
}: WorkOrderContactContextSummaryProps) {
  return (
    <WorkOrderSection>
      <WorkOrderSectionHeader
        description="Compact request context. Full metadata remains in the sidebar."
        title="Client, Location & Requester"
      />

      <dl className="mt-4 grid gap-x-5 gap-y-1 border-t border-neutral-200 pt-3 sm:grid-cols-2">
        <Metric label="Client" value={clientDisplayName} />
        <Metric label="Location" value={locationName} />
        <Metric label="Requester" value={requesterName} />
        <Metric
          label="Requester contact"
          value={
            [requesterEmail, requesterPhone].filter(Boolean).join(" • ") ||
            "Not provided"
          }
        />
      </dl>
    </WorkOrderSection>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <WorkOrderCompactRow label={label} value={value} />;
}
