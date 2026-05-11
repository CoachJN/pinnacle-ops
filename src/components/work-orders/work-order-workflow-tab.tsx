"use client";

import type { ComponentProps } from "react";
import { AssignmentPanel } from "./assignment-panel";
import { WorkOrderAvailableActionsPanel } from "./work-order-available-actions-panel";
import { WorkOrderNotesPanel } from "./work-order-notes-panel";
import { WorkOrderSchedulingSummary } from "./work-order-scheduling-summary";
import {
  deriveWorkOrderWorkflowStage,
  deriveWorkflowActions,
  deriveWorkflowSchedulingSummary,
} from "./work-order-workflow-model";
import { WorkOrderWorkflowStageTracker } from "./work-order-workflow-stage-tracker";
import type { WorkOrderStatus } from "@/modules/work-orders";

interface WorkOrderWorkflowTabProps {
  activeAssignment: ComponentProps<typeof AssignmentPanel>["activeAssignment"];
  allowedActions: ComponentProps<typeof AssignmentPanel>["allowedActions"] & {
    canUpdateStatus: boolean;
  };
  allowedTransitions: readonly WorkOrderStatus[];
  assignmentMessage: string | null;
  assignmentNotes: string;
  assignmentTone: "success" | "error" | "info";
  assignments: ComponentProps<typeof AssignmentPanel>["assignments"];
  assignableContractors: ComponentProps<typeof AssignmentPanel>["assignableContractors"];
  assignableInternalUsers: ComponentProps<typeof AssignmentPanel>["assignableInternalUsers"];
  assignedContractorLabel: string;
  contractorOrganizationId: string;
  currentStatus: WorkOrderStatus;
  dueDate: string | null;
  internalAssignees: ComponentProps<typeof AssignmentPanel>["internalAssignees"];
  internalAssignmentMessage: string | null;
  internalAssignmentTone: "success" | "error" | "info";
  isMutatingAssignment: boolean;
  isSavingInternalAssignment: boolean;
  isUpdatingStatus: boolean;
  notes: ComponentProps<typeof WorkOrderNotesPanel>["notes"];
  onAcceptAssignment: () => void;
  onAssignmentNotesChange: (value: string) => void;
  onCompleteAssignment: () => void;
  onContractorOrganizationIdChange: (value: string) => void;
  onDeclineAssignment: () => void;
  onNotesChange: ComponentProps<typeof WorkOrderNotesPanel>["onNotesChange"];
  onSaveContractorAssignment: () => void;
  onSaveInternalAssignment: () => void;
  onScheduledDateChange: (value: string) => void;
  onSelectedCoordinatorUserIdChange: (value: string) => void;
  onSelectedManagerUserIdChange: (value: string) => void;
  onStatusChange: (nextStatus: WorkOrderStatus) => void;
  onTimeWindowEndChange: (value: string) => void;
  onTimeWindowStartChange: (value: string) => void;
  pendingStatus: WorkOrderStatus | null;
  requestedServiceDate: string | null;
  scheduledDate: string;
  canAddNote: boolean;
  selectedCoordinatorUserId: string;
  selectedManagerUserId: string;
  statusMessage: string | null;
  statusTone: "success" | "error" | "info";
  timeWindowEnd: string;
  timeWindowStart: string;
  workOrderId: string;
}

export function WorkOrderWorkflowTab({
  activeAssignment,
  allowedActions,
  allowedTransitions,
  assignmentMessage,
  assignmentNotes,
  assignmentTone,
  assignments,
  assignableContractors,
  assignableInternalUsers,
  assignedContractorLabel,
  contractorOrganizationId,
  currentStatus,
  dueDate,
  internalAssignees,
  internalAssignmentMessage,
  internalAssignmentTone,
  isMutatingAssignment,
  isSavingInternalAssignment,
  isUpdatingStatus,
  notes,
  onAcceptAssignment,
  onAssignmentNotesChange,
  onCompleteAssignment,
  onContractorOrganizationIdChange,
  onDeclineAssignment,
  onNotesChange,
  onSaveContractorAssignment,
  onSaveInternalAssignment,
  onScheduledDateChange,
  onSelectedCoordinatorUserIdChange,
  onSelectedManagerUserIdChange,
  onStatusChange,
  onTimeWindowEndChange,
  onTimeWindowStartChange,
  pendingStatus,
  requestedServiceDate,
  scheduledDate,
  canAddNote,
  selectedCoordinatorUserId,
  selectedManagerUserId,
  statusMessage,
  statusTone,
  timeWindowEnd,
  timeWindowStart,
  workOrderId,
}: WorkOrderWorkflowTabProps) {
  const stageModel = deriveWorkOrderWorkflowStage(currentStatus);
  const actionModel = deriveWorkflowActions({
    allowedTransitions,
    statusActionEnabled: allowedActions.canUpdateStatus,
  });
  const schedulingModel = deriveWorkflowSchedulingSummary({
    activeAssignmentStatus: activeAssignment?.status ?? null,
    dueDate,
    requestedServiceDate,
    scheduledDate: activeAssignment?.scheduledDate ?? null,
    timeWindowEnd: activeAssignment?.timeWindowEnd ?? null,
    timeWindowStart: activeAssignment?.timeWindowStart ?? null,
  });
  return (
    <section
      aria-labelledby="work-order-tab-workflow"
      className="space-y-4"
      id="work-order-panel-workflow"
      role="tabpanel"
    >
      <WorkOrderWorkflowStageTracker model={stageModel} />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <WorkOrderAvailableActionsPanel
          isUpdatingStatus={isUpdatingStatus}
          model={actionModel}
          onStatusChange={onStatusChange}
          pendingStatus={pendingStatus}
          statusMessage={statusMessage}
          statusTone={statusTone}
        />

        <AssignmentPanel
          activeAssignment={activeAssignment}
          allowedActions={allowedActions}
          assignmentMessage={assignmentMessage}
          assignmentNotes={assignmentNotes}
          assignments={assignments}
          assignmentTone={assignmentTone}
          assignableContractors={assignableContractors}
          assignableInternalUsers={assignableInternalUsers}
          assignedContractorLabel={assignedContractorLabel}
          contractorOrganizationId={contractorOrganizationId}
          internalAssignees={internalAssignees}
          internalAssignmentMessage={internalAssignmentMessage}
          internalAssignmentTone={internalAssignmentTone}
          isMutatingAssignment={isMutatingAssignment}
          isSavingInternalAssignment={isSavingInternalAssignment}
          onAcceptAssignment={onAcceptAssignment}
          onAssignmentNotesChange={onAssignmentNotesChange}
          onCompleteAssignment={onCompleteAssignment}
          onContractorOrganizationIdChange={onContractorOrganizationIdChange}
          onDeclineAssignment={onDeclineAssignment}
          onSaveContractorAssignment={onSaveContractorAssignment}
          onSaveInternalAssignment={onSaveInternalAssignment}
          onScheduledDateChange={onScheduledDateChange}
          onSelectedCoordinatorUserIdChange={onSelectedCoordinatorUserIdChange}
          onSelectedManagerUserIdChange={onSelectedManagerUserIdChange}
          onTimeWindowEndChange={onTimeWindowEndChange}
          onTimeWindowStartChange={onTimeWindowStartChange}
          scheduledDate={scheduledDate}
          selectedCoordinatorUserId={selectedCoordinatorUserId}
          selectedManagerUserId={selectedManagerUserId}
          showHistory={false}
          timeWindowEnd={timeWindowEnd}
          timeWindowStart={timeWindowStart}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <WorkOrderSchedulingSummary model={schedulingModel} />

        <WorkOrderNotesPanel
          canAddNote={canAddNote}
          notes={notes}
          onNotesChange={onNotesChange}
          workOrderId={workOrderId}
        />
      </div>
    </section>
  );
}
