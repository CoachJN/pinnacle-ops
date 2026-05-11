import type { WorkOrderStatus } from "@/modules/work-orders";
import { WorkOrderContactContextSummary } from "./work-order-contact-context-summary";
import {
  buildWorkOrderRecentActivitySnapshot,
  deriveWorkOrderOperationalSummary,
  type WorkOrderAssignmentSnapshot,
  type WorkOrderAttachmentSnapshot,
  type WorkOrderNoteSnapshot,
  type WorkOrderTimelineEntry,
} from "./work-order-display-model";
import { WorkOrderNextActionPanel } from "./work-order-next-action-panel";
import { WorkOrderOperationalSummary } from "./work-order-operational-summary";
import { WorkOrderOwnershipSummary } from "./work-order-ownership-summary";
import { WorkOrderRecentActivity } from "./work-order-recent-activity";
import type { WorkOrderTabId } from "./work-order-tabs";
import { WorkOrderTimingSummary } from "./work-order-timing-summary";

interface WorkOrderOverviewTabProps {
  activeAssignmentStatus: WorkOrderAssignmentSnapshot["status"] | null;
  assignments: WorkOrderAssignmentSnapshot[];
  assignedContractorLabel: string;
  categoryLabel: string;
  clientDisplayName: string;
  closedAt: string | null;
  closedAtLabel: string;
  coordinatorLabel: string;
  createdAt: string;
  createdAtLabel: string;
  description: string;
  dueDate: string | null;
  dueDateLabel: string;
  locationName: string;
  managerLabel: string;
  onOpenTab: (tabId: WorkOrderTabId) => void;
  priorityLabel: string;
  quoteRequirementLabel: string;
  requestedByEmail: string | null;
  requestedByName: string;
  requestedByPhone: string | null;
  requestedServiceDateLabel: string;
  requiresQuote: boolean;
  status: WorkOrderStatus;
  statusLabel: string;
  timeline: WorkOrderTimelineEntry[];
  title: string;
  updatedAtLabel: string;
  notes: WorkOrderNoteSnapshot[];
  attachments: WorkOrderAttachmentSnapshot[];
}

export function WorkOrderOverviewTab(props: WorkOrderOverviewTabProps) {
  const summary = deriveWorkOrderOperationalSummary({
    activeAssignmentStatus: props.activeAssignmentStatus,
    assignedContractorLabel: props.assignedContractorLabel,
    coordinatorLabel: props.coordinatorLabel,
    createdAt: props.createdAt,
    dueDate: props.dueDate,
    closedAt: props.closedAt,
    managerLabel: props.managerLabel,
    requiresQuote: props.requiresQuote,
    status: props.status,
  });
  const recentActivity = buildWorkOrderRecentActivitySnapshot({
    assignments: props.assignments,
    attachments: props.attachments,
    notes: props.notes,
    timeline: props.timeline,
  });

  return (
    <section
      aria-labelledby="work-order-tab-overview"
      className="space-y-4"
      id="work-order-panel-overview"
      role="tabpanel"
    >
      <WorkOrderNextActionPanel summary={summary} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.9fr)]">
        <WorkOrderOperationalSummary
          categoryLabel={props.categoryLabel}
          createdAtLabel={props.createdAtLabel}
          description={props.description}
          dueDateLabel={props.dueDateLabel}
          lastUpdatedLabel={props.updatedAtLabel}
          priorityLabel={props.priorityLabel}
          quoteRequirementLabel={props.quoteRequirementLabel}
          statusLabel={props.statusLabel}
          title={props.title}
        />
        <WorkOrderTimingSummary
          ageLabel={summary.ageLabel}
          closedAtLabel={props.closedAtLabel}
          createdAtLabel={props.createdAtLabel}
          dueDateLabel={props.dueDateLabel}
          isOverdue={summary.isOverdue}
          requestedServiceDateLabel={props.requestedServiceDateLabel}
          updatedAtLabel={props.updatedAtLabel}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(18rem,0.9fr)]">
        <WorkOrderRecentActivity
          items={recentActivity}
          onOpenTab={props.onOpenTab}
        />
        <div className="space-y-4">
          <WorkOrderOwnershipSummary
            activeAssignmentStatusLabel={
              props.activeAssignmentStatus
                ? props.activeAssignmentStatus.replaceAll("_", " ")
                : "No active contractor assignment"
            }
            assignedContractorLabel={props.assignedContractorLabel}
            coordinatorLabel={props.coordinatorLabel}
            managerLabel={props.managerLabel}
            ownershipWarning={summary.ownershipWarning}
          />
          <WorkOrderContactContextSummary
            clientDisplayName={props.clientDisplayName}
            locationName={props.locationName}
            requesterEmail={props.requestedByEmail}
            requesterName={props.requestedByName}
            requesterPhone={props.requestedByPhone}
          />
        </div>
      </div>
    </section>
  );
}
