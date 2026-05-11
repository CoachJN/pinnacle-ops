import type { ContactSummary } from "@/types/contact";
import { WorkOrderStatusPill } from "./work-order-status-pill";
import { WorkOrderSidebarAdvancedDetails } from "./work-order-sidebar-advanced-details";
import { WorkOrderSidebarGrid } from "./work-order-sidebar-grid";
import { WorkOrderSidebarRow } from "./work-order-sidebar-row";
import { WorkOrderSidebarSection } from "./work-order-sidebar-section";

interface WorkOrderSidebarProps {
  clientDisplayName: string;
  clientId: string;
  coordinatorLabel: string;
  createdAtLabel: string;
  dueDateLabel: string;
  locationCode: string | undefined;
  locationId: string;
  locationName: string;
  managerLabel: string;
  priorityLabel: string;
  quoteRequirementLabel: string;
  quoteThresholdLabel: string;
  requestedByEmail: string | null;
  requestedByName: string;
  requestedByPhone: string | null;
  requestedServiceDateLabel: string;
  requesterContact?: ContactSummary | null;
  siteContact?: ContactSummary | null;
  statusLabel: string;
  updatedAtLabel: string;
}

export function WorkOrderSidebar({
  clientDisplayName,
  clientId,
  coordinatorLabel,
  createdAtLabel,
  dueDateLabel,
  locationCode,
  locationId,
  locationName,
  managerLabel,
  priorityLabel,
  quoteRequirementLabel,
  quoteThresholdLabel,
  requestedByEmail,
  requestedByName,
  requestedByPhone,
  requestedServiceDateLabel,
  requesterContact,
  siteContact,
  statusLabel,
  updatedAtLabel,
}: WorkOrderSidebarProps) {
  return (
    <div className="space-y-3 border border-neutral-200/80 bg-white px-4 py-4 xl:sticky xl:top-28">
      <div className="flex flex-wrap gap-1.5">
        <WorkOrderStatusPill>{statusLabel}</WorkOrderStatusPill>
        <WorkOrderStatusPill tone="muted">{priorityLabel}</WorkOrderStatusPill>
        <WorkOrderStatusPill tone="warning">
          {quoteRequirementLabel}
        </WorkOrderStatusPill>
      </div>

      <div className="space-y-3 divide-y divide-neutral-200">
        <WorkOrderSidebarSection title="People & Place">
          <WorkOrderSidebarGrid>
            <WorkOrderSidebarRow label="Client" value={clientDisplayName} />
            <WorkOrderSidebarRow label="Location" value={locationName} />
            <WorkOrderSidebarRow label="Requester" value={requestedByName} />
            <WorkOrderSidebarRow
              label="Contact"
              value={
                [requestedByEmail, requestedByPhone]
                  .filter(Boolean)
                  .join(" • ") || "Not provided"
              }
            />
            <WorkOrderSidebarRow label="Coordinator" value={coordinatorLabel} />
            <WorkOrderSidebarRow label="Manager" value={managerLabel} />
            <WorkOrderSidebarRow
              label="Requester ref"
              value={formatLinkedContact(requesterContact)}
            />
            <WorkOrderSidebarRow
              label="Site contact"
              value={formatLinkedContact(siteContact)}
            />
          </WorkOrderSidebarGrid>
        </WorkOrderSidebarSection>

        <div className="pt-3">
          <WorkOrderSidebarSection title="Dates & Ops">
            <WorkOrderSidebarGrid>
              <WorkOrderSidebarRow
                label="Requested"
                value={requestedServiceDateLabel}
              />
              <WorkOrderSidebarRow label="Due" value={dueDateLabel} />
              <WorkOrderSidebarRow label="Created" value={createdAtLabel} />
              <WorkOrderSidebarRow label="Updated" value={updatedAtLabel} />
              <WorkOrderSidebarRow
                label="Quote req"
                value={quoteRequirementLabel}
              />
              <WorkOrderSidebarRow
                label="Threshold"
                value={quoteThresholdLabel}
              />
            </WorkOrderSidebarGrid>
          </WorkOrderSidebarSection>
        </div>

        <div className="pt-3">
          <WorkOrderSidebarAdvancedDetails>
            <WorkOrderSidebarGrid>
              <WorkOrderSidebarRow label="Client ID" value={clientId} />
              <WorkOrderSidebarRow label="Location ID" value={locationId} />
              <WorkOrderSidebarRow
                label="Loc code"
                value={locationCode ?? "Not set"}
              />
            </WorkOrderSidebarGrid>
          </WorkOrderSidebarAdvancedDetails>
        </div>
      </div>
    </div>
  );
}

function formatLinkedContact(
  contact: ContactSummary | null | undefined,
): string {
  if (!contact) {
    return "Not linked";
  }

  return [
    contact.displayName,
    contact.email,
    contact.primaryPhone,
    contact.preferredLanguage ? `Language: ${contact.preferredLanguage}` : null,
  ]
    .filter(Boolean)
    .join(" • ");
}
