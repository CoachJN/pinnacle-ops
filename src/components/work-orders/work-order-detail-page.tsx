"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ActionFeedback } from "@/components/shared/action-feedback";
import {
  WORK_ORDER_CATEGORY_LABELS,
  WORK_ORDER_PRIORITY_LABELS,
  WORK_ORDER_STATUS_LABELS,
  type WorkOrderCategory,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from "@/modules/work-orders";
import type { ContactSummary } from "@/types/contact";
import { formatDate, formatDateTime } from "./formatting";
import { WorkOrderCommunicationsTab } from "./work-order-communications-tab";
import {
  deriveWorkOrderOperationalSummary,
  type WorkOrderTimelineEntry,
} from "./work-order-display-model";
import { deriveWorkOrderFinancialSummary } from "./work-order-financial-model";
import { WorkOrderFinanceTab } from "./work-order-finance-tab";
import type { WorkOrderFileAttachment } from "./work-order-files-model";
import { WorkOrderFilesTab } from "./work-order-files-tab";
import { WorkOrderHeader } from "./work-order-header";
import { WorkOrderHistoryAuditTab } from "./work-order-history-audit-tab";
import { WorkOrderOverviewTab } from "./work-order-overview-tab";
import { WorkOrderSidebar } from "./work-order-sidebar";
import { WorkOrderTabs, type WorkOrderTabId } from "./work-order-tabs";
import { WorkOrderWorkflowTab } from "./work-order-workflow-tab";

interface WorkOrderDetailPageProps {
  workOrderId: string;
}

interface RelatedSummary {
  clientOrganization: {
    id: string;
    name?: string;
    displayName?: string;
  };
  location: {
    id: string;
    name?: string;
    code?: string;
    clientOrganizationId?: string;
  };
}

interface WorkOrderNoteItem {
  id: string;
  workOrderId: string;
  body: string;
  createdByUserId: string;
  authorDisplayName: string;
  createdAt: string;
  updatedAt: string;
}

interface AssignmentItem {
  id: string;
  workOrderId: string;
  contractorOrganizationId: string | null;
  assigneeType: "internal" | "contractor";
  assigneeUserId: string;
  assigneeDisplayName: string;
  assignedByUserId: string;
  assignedByDisplayName: string;
  status: "assigned" | "accepted" | "declined" | "completed" | "cancelled";
  scheduledDate: string | null;
  timeWindowStart: string | null;
  timeWindowEnd: string | null;
  assignedAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AssignableUser {
  id: string;
  label: string;
  role: string;
}

interface AssignableContractor {
  id: string;
  label: string;
  status: string;
  parentContractorId: string | null;
  trades: string[];
  serviceCategories: string[];
  isAssignable: boolean;
  reason: string | null;
}

interface InternalAssignees {
  coordinator: AssignableUser | null;
  manager: AssignableUser | null;
}

interface AssignedContractorSummary {
  id: string;
  label: string;
}

interface WorkOrderDetailRecord {
  id: string;
  workOrderNumber: string;
  title: string;
  description: string;
  clientOrganizationId: string;
  locationId: string;
  requestedByContactId?: string | null;
  siteContactId?: string | null;
  assignedContractorId?: string | null;
  assignedContractorOrgId?: string | null;
  status?: WorkOrderStatus;
  lifecycleStatus?: WorkOrderStatus;
  priority: WorkOrderPriority;
  category: WorkOrderCategory;
  requestedServiceDate: string | null;
  requiresQuote: boolean;
  quoteRequiredThresholdCents: number | null;
  requestedByName: string;
  requestedByEmail: string | null;
  requestedByPhone: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  related: RelatedSummary;
  notes: WorkOrderNoteItem[];
  attachments: WorkOrderFileAttachment[];
  timeline: WorkOrderTimelineEntry[];
  assignments: AssignmentItem[];
  activeAssignment: AssignmentItem | null;
  activeAssignmentId: string | null;
  internalAssignees: InternalAssignees;
  assignedContractor: AssignedContractorSummary | null;
  assignableInternalUsers: AssignableUser[];
  assignableContractors: AssignableContractor[];
  allowedTransitions: WorkOrderStatus[];
  allowedActions: {
    canUpdateStatus: boolean;
    canAddNote: boolean;
    canAddAttachment: boolean;
    canAssign: boolean;
    canReassign: boolean;
    canAcceptAssignment: boolean;
    canDeclineAssignment: boolean;
    canCompleteAssignment: boolean;
  };
  sectionVisibility: {
    showFinancePanel: boolean;
  };
}

interface WorkOrderDetailSuccessResponse {
  data?: {
    workOrder?: WorkOrderDetailRecord;
  };
}

interface WorkOrderStatusSuccessResponse {
  data?: {
    workOrder?: WorkOrderDetailRecord;
  };
}

interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
    statusCode?: number;
  };
}

type PageState = "loading" | "ready" | "not_found" | "forbidden" | "error";

export function WorkOrderDetailPage({ workOrderId }: WorkOrderDetailPageProps) {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [workOrder, setWorkOrder] = useState<WorkOrderDetailRecord | null>(
    null,
  );
  const [contactsById, setContactsById] = useState<
    Record<string, ContactSummary>
  >({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | "info">(
    "info",
  );
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<WorkOrderStatus | null>(
    null,
  );
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(
    null,
  );
  const [assignmentTone, setAssignmentTone] = useState<
    "success" | "error" | "info"
  >("info");
  const [isMutatingAssignment, setIsMutatingAssignment] = useState(false);
  const [internalAssignmentMessage, setInternalAssignmentMessage] = useState<
    string | null
  >(null);
  const [internalAssignmentTone, setInternalAssignmentTone] = useState<
    "success" | "error" | "info"
  >("info");
  const [isSavingInternalAssignment, setIsSavingInternalAssignment] =
    useState(false);
  const [contractorOrganizationId, setContractorOrganizationId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [timeWindowStart, setTimeWindowStart] = useState("");
  const [timeWindowEnd, setTimeWindowEnd] = useState("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [activeTab, setActiveTab] = useState<WorkOrderTabId>("overview");
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
  const [selectedCoordinatorUserId, setSelectedCoordinatorUserId] =
    useState("");
  const [selectedManagerUserId, setSelectedManagerUserId] = useState("");

  const loadWorkOrderDetail = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!options.silent) {
        setPageState("loading");
      }
      setErrorMessage(null);
      setStatusMessage(null);

      const response = await fetch(`/api/work-orders/${workOrderId}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as
        | WorkOrderDetailSuccessResponse
        | ApiErrorResponse;

      if (!response.ok) {
        const errorPayload = payload as ApiErrorResponse;
        const nextState = mapResponseStatusToPageState(response.status);
        setPageState(nextState);
        throw new Error(
          getApiErrorMessage(
            errorPayload,
            "Unable to load work order details.",
          ),
        );
      }

      const successPayload = payload as WorkOrderDetailSuccessResponse;
      const nextWorkOrder = successPayload.data?.workOrder ?? null;
      if (!nextWorkOrder) {
        setPageState("error");
        throw new Error(
          "Work order details were returned in an unexpected format.",
        );
      }

      setWorkOrder(nextWorkOrder);
      const contactIds = [
        nextWorkOrder.requestedByContactId,
        nextWorkOrder.siteContactId,
      ]
        .filter(Boolean)
        .join(",");
      if (contactIds) {
        const params = new URLSearchParams({ ids: contactIds });
        params.set("locationId", nextWorkOrder.locationId);
        const contactsResponse = await fetch(
          `/api/contacts?${params.toString()}`,
          {
            cache: "no-store",
          },
        );
        const contactsPayload = (await contactsResponse.json()) as {
          contacts: ContactSummary[];
        };
        if (contactsResponse.ok) {
          setContactsById(
            Object.fromEntries(
              contactsPayload.contacts.map((contact) => [contact.id, contact]),
            ),
          );
        }
      } else {
        setContactsById({});
      }
      setContractorOrganizationId(
        nextWorkOrder.activeAssignment?.contractorOrganizationId ?? "",
      );
      setScheduledDate(
        toDateInputValue(nextWorkOrder.activeAssignment?.scheduledDate ?? null),
      );
      setTimeWindowStart(
        toDateTimeLocalValue(
          nextWorkOrder.activeAssignment?.timeWindowStart ?? null,
        ),
      );
      setTimeWindowEnd(
        toDateTimeLocalValue(
          nextWorkOrder.activeAssignment?.timeWindowEnd ?? null,
        ),
      );
      setAssignmentNotes(nextWorkOrder.activeAssignment?.notes ?? "");
      setSelectedCoordinatorUserId(
        nextWorkOrder.internalAssignees.coordinator?.id ?? "",
      );
      setSelectedManagerUserId(
        nextWorkOrder.internalAssignees.manager?.id ?? "",
      );
      setPageState("ready");
    },
    [workOrderId],
  );

  useEffect(() => {
    let isCancelled = false;

    void (async () => {
      try {
        await loadWorkOrderDetail();
      } catch (error) {
        if (!isCancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load work order details.",
          );
        }
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [loadWorkOrderDetail]);

  useEffect(() => {
    if (!pendingSectionId) {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      document.getElementById(pendingSectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      setPendingSectionId(null);
    });

    return () => {
      window.cancelAnimationFrame(frame);
    };
  }, [activeTab, pendingSectionId]);

  async function handleStatusChange(nextStatus: WorkOrderStatus) {
    if (isUpdatingStatus) {
      return;
    }

    setIsUpdatingStatus(true);
    setPendingStatus(nextStatus);
    setStatusMessage(null);

    try {
      const response = await fetch(`/api/work-orders/${workOrderId}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: nextStatus,
        }),
      });
      const payload = (await response.json()) as
        | WorkOrderStatusSuccessResponse
        | ApiErrorResponse;

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(payload, "Unable to update work order status."),
        );
      }

      const updatedWorkOrder =
        (payload as WorkOrderStatusSuccessResponse).data?.workOrder ?? null;

      if (!updatedWorkOrder) {
        throw new Error("Status update returned an unexpected response.");
      }

      const updatedStatus =
        updatedWorkOrder.status ?? updatedWorkOrder.lifecycleStatus ?? "new";
      setWorkOrder(updatedWorkOrder);
      setStatusTone("success");
      setStatusMessage(
        `Status updated to ${WORK_ORDER_STATUS_LABELS[updatedStatus]}.`,
      );
      router.refresh();
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to update work order status.",
      );
    } finally {
      setIsUpdatingStatus(false);
      setPendingStatus(null);
    }
  }

  async function handleAssignmentMutation(
    path: string,
    body?: Record<string, unknown>,
    method = "POST",
  ) {
    setIsMutatingAssignment(true);
    setAssignmentMessage(null);

    try {
      const response = await fetch(path, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const payload = (await response.json()) as
        | WorkOrderDetailSuccessResponse
        | ApiErrorResponse;

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(payload, "Unable to update assignment."),
        );
      }

      const updatedWorkOrder =
        (payload as WorkOrderDetailSuccessResponse).data?.workOrder ?? null;
      if (!updatedWorkOrder) {
        throw new Error("Assignment update returned an unexpected response.");
      }

      setWorkOrder(updatedWorkOrder);
      setAssignmentTone("success");
      setAssignmentMessage("Assignment updated.");
      setContractorOrganizationId(
        updatedWorkOrder.activeAssignment?.contractorOrganizationId ?? "",
      );
      setScheduledDate(
        toDateInputValue(
          updatedWorkOrder.activeAssignment?.scheduledDate ?? null,
        ),
      );
      setTimeWindowStart(
        toDateTimeLocalValue(
          updatedWorkOrder.activeAssignment?.timeWindowStart ?? null,
        ),
      );
      setTimeWindowEnd(
        toDateTimeLocalValue(
          updatedWorkOrder.activeAssignment?.timeWindowEnd ?? null,
        ),
      );
      setAssignmentNotes(updatedWorkOrder.activeAssignment?.notes ?? "");
      setSelectedCoordinatorUserId(
        updatedWorkOrder.internalAssignees.coordinator?.id ?? "",
      );
      setSelectedManagerUserId(
        updatedWorkOrder.internalAssignees.manager?.id ?? "",
      );
      router.refresh();
    } catch (error) {
      setAssignmentTone("error");
      setAssignmentMessage(
        error instanceof Error ? error.message : "Unable to update assignment.",
      );
    } finally {
      setIsMutatingAssignment(false);
    }
  }

  async function handleAssignOrReassign() {
    if (!workOrder || !contractorOrganizationId) {
      setAssignmentTone("error");
      setAssignmentMessage("Select a contractor before saving the assignment.");
      return;
    }

    const selectedContractor = workOrder.assignableContractors.find(
      (candidate) => candidate.id === contractorOrganizationId,
    );
    if (!selectedContractor) {
      setAssignmentTone("error");
      setAssignmentMessage("Selected contractor is not available.");
      return;
    }

    if (!selectedContractor.isAssignable) {
      setAssignmentTone("error");
      setAssignmentMessage(
        selectedContractor.reason ?? "Selected contractor is not assignable.",
      );
      return;
    }

    const payload: Record<string, unknown> = {
      contractorOrganizationId: selectedContractor.id,
      scheduledDate: toIsoStringOrNull(scheduledDate),
      timeWindowStart: toIsoStringOrNull(timeWindowStart),
      timeWindowEnd: toIsoStringOrNull(timeWindowEnd),
      notes: assignmentNotes.trim() || null,
    };

    if (workOrder.activeAssignment) {
      await handleAssignmentMutation(
        `/api/work-orders/${workOrder.id}/assignments/reassign`,
        {
          ...payload,
          currentAssignmentId: workOrder.activeAssignment.id,
        },
      );
      return;
    }

    await handleAssignmentMutation(
      `/api/work-orders/${workOrder.id}/assignments`,
      payload,
    );
  }

  async function handleSaveInternalAssignment() {
    if (!workOrder) {
      return;
    }

    setIsSavingInternalAssignment(true);
    setInternalAssignmentMessage(null);

    try {
      const response = await fetch(
        `/api/work-orders/${workOrder.id}/assign-internal`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            coordinatorUserId: selectedCoordinatorUserId || null,
            managerUserId: selectedManagerUserId || null,
          }),
        },
      );
      const payload = (await response.json()) as
        | WorkOrderDetailSuccessResponse
        | ApiErrorResponse;

      if (!response.ok) {
        throw new Error(
          getApiErrorMessage(payload, "Unable to update internal ownership."),
        );
      }

      const updatedWorkOrder =
        (payload as WorkOrderDetailSuccessResponse).data?.workOrder ?? null;
      if (!updatedWorkOrder) {
        throw new Error(
          "Internal assignment update returned an unexpected response.",
        );
      }

      setWorkOrder(updatedWorkOrder);
      setInternalAssignmentTone("success");
      setInternalAssignmentMessage("Internal owners updated.");
      setSelectedCoordinatorUserId(
        updatedWorkOrder.internalAssignees.coordinator?.id ?? "",
      );
      setSelectedManagerUserId(
        updatedWorkOrder.internalAssignees.manager?.id ?? "",
      );
      router.refresh();
    } catch (error) {
      setInternalAssignmentTone("error");
      setInternalAssignmentMessage(
        error instanceof Error
          ? error.message
          : "Unable to update internal ownership.",
      );
    } finally {
      setIsSavingInternalAssignment(false);
    }
  }

  if (pageState === "loading") {
    return <WorkOrderDetailLoadingState />;
  }

  if (pageState === "not_found") {
    return (
      <WorkOrderDetailState
        description={
          errorMessage ??
          "The requested work order could not be found or is no longer available."
        }
        title="Work order not found"
        tone="neutral"
      />
    );
  }

  if (pageState === "forbidden") {
    return (
      <WorkOrderDetailState
        description={
          errorMessage ??
          "You do not have permission to view this work order in the dashboard."
        }
        title="Permission denied"
        tone="error"
      />
    );
  }

  if (pageState === "error" || !workOrder) {
    return (
      <section className="space-y-4">
        <BackLink />
        <ActionFeedback
          message={errorMessage ?? "Work order details could not be loaded."}
        />
      </section>
    );
  }

  const requesterContact = workOrder.requestedByContactId
    ? (contactsById[workOrder.requestedByContactId] ?? null)
    : null;
  const siteContact = workOrder.siteContactId
    ? (contactsById[workOrder.siteContactId] ?? null)
    : null;
  const clientDisplayName =
    workOrder.related.clientOrganization.displayName ??
    workOrder.related.clientOrganization.name ??
    workOrder.clientOrganizationId;
  const coordinatorLabel =
    workOrder.internalAssignees.coordinator?.label ?? "Unassigned";
  const managerLabel =
    workOrder.internalAssignees.manager?.label ?? "Unassigned";
  const assignedContractorLabel =
    workOrder.assignedContractor?.label ?? "Unassigned";
  const currentStatus = workOrder.status ?? workOrder.lifecycleStatus ?? "new";
  const currentStatusLabel = WORK_ORDER_STATUS_LABELS[currentStatus];
  const categoryLabel = WORK_ORDER_CATEGORY_LABELS[workOrder.category];
  const quoteRequirementLabel = workOrder.requiresQuote
    ? "Required"
    : "Not required";
  const quoteThresholdLabel = formatQuoteThreshold(
    workOrder.quoteRequiredThresholdCents,
  );
  const createInvoiceHref = workOrder.sectionVisibility.showFinancePanel
    ? `/dashboard/work-orders/${workOrder.id}/invoice/new`
    : null;
  const overviewSummary = deriveWorkOrderOperationalSummary({
    activeAssignmentStatus: workOrder.activeAssignment?.status ?? null,
    assignedContractorLabel,
    coordinatorLabel,
    createdAt: workOrder.createdAt,
    dueDate: workOrder.dueDate,
    closedAt: workOrder.closedAt,
    managerLabel,
    requiresQuote: workOrder.requiresQuote,
    status: currentStatus,
  });
  const headerFinancialSummary = deriveWorkOrderFinancialSummary({
    activeClientQuote: null,
    clientQuotes: [],
    contractorQuotes: [],
    invoices: [],
    requiresQuote: workOrder.requiresQuote,
    workOrderStatus: currentStatus,
  });

  function openWorkspaceTarget(tabId: WorkOrderTabId, sectionId?: string) {
    setActiveTab(tabId);
    setPendingSectionId(sectionId ?? null);
  }

  return (
    <section className="space-y-4 pb-8">
      <BackLink />

      <WorkOrderHeader
        agingLabel={overviewSummary.ageLabel}
        assignedContractorLabel={assignedContractorLabel}
        coordinatorLabel={coordinatorLabel}
        createInvoiceHref={createInvoiceHref}
        financialSignalLabel={headerFinancialSummary.headerSignal}
        managerLabel={managerLabel}
        nextActionLabel={overviewSummary.nextAction.label}
        onOpenAddNote={() =>
          openWorkspaceTarget("workflow", "workflow-operational-notes")
        }
        onOpenAssignment={() =>
          openWorkspaceTarget("workflow", "workflow-assignment-dispatch")
        }
        onOpenQuoteWorkflow={() =>
          openWorkspaceTarget("quotes-finance", "quote-workflow")
        }
        onOpenStatusActions={() =>
          openWorkspaceTarget("workflow", "workflow-available-actions")
        }
        priorityLabel={WORK_ORDER_PRIORITY_LABELS[workOrder.priority]}
        priorityToneClassName={priorityBadgeClassNames[workOrder.priority]}
        riskLabel={overviewSummary.riskLabel}
        statusLabel={currentStatusLabel}
        statusToneClassName={statusBadgeClassNames[currentStatus]}
        title={workOrder.title}
        workOrderNumber={workOrder.workOrderNumber}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.9fr)_minmax(18rem,0.74fr)] xl:items-start">
        <section className="min-w-0 space-y-4">
          <WorkOrderTabs
            activeTab={activeTab}
            attachmentCount={workOrder.attachments.length}
            onChange={setActiveTab}
          />

          <div className="min-w-0 border border-neutral-200/80 bg-[linear-gradient(180deg,#ffffff,#fafaf9)] p-4 sm:p-4">
            {activeTab === "overview" ? (
              <WorkOrderOverviewTab
                activeAssignmentStatus={
                  workOrder.activeAssignment?.status ?? null
                }
                assignments={workOrder.assignments}
                assignedContractorLabel={assignedContractorLabel}
                attachments={workOrder.attachments}
                categoryLabel={categoryLabel}
                clientDisplayName={clientDisplayName}
                closedAt={workOrder.closedAt}
                closedAtLabel={formatDateTime(workOrder.closedAt)}
                createdAtLabel={formatDateTime(workOrder.createdAt)}
                createdAt={workOrder.createdAt}
                description={workOrder.description}
                dueDate={workOrder.dueDate}
                dueDateLabel={formatDate(workOrder.dueDate)}
                locationName={
                  workOrder.related.location.name ?? workOrder.locationId
                }
                managerLabel={managerLabel}
                notes={workOrder.notes}
                onOpenTab={(tabId) => openWorkspaceTarget(tabId)}
                priorityLabel={WORK_ORDER_PRIORITY_LABELS[workOrder.priority]}
                quoteRequirementLabel={quoteRequirementLabel}
                requestedByEmail={workOrder.requestedByEmail}
                requestedByName={workOrder.requestedByName}
                requestedByPhone={workOrder.requestedByPhone}
                requestedServiceDateLabel={formatDate(
                  workOrder.requestedServiceDate,
                )}
                requiresQuote={workOrder.requiresQuote}
                status={currentStatus}
                statusLabel={currentStatusLabel}
                timeline={workOrder.timeline}
                title={workOrder.title}
                updatedAtLabel={formatDateTime(workOrder.updatedAt)}
                coordinatorLabel={coordinatorLabel}
              />
            ) : null}

            {activeTab === "workflow" ? (
              <WorkOrderWorkflowTab
                activeAssignment={workOrder.activeAssignment}
                allowedActions={workOrder.allowedActions}
                allowedTransitions={workOrder.allowedTransitions}
                assignmentMessage={assignmentMessage}
                assignmentNotes={assignmentNotes}
                assignments={workOrder.assignments}
                assignmentTone={assignmentTone}
                assignableContractors={workOrder.assignableContractors}
                assignableInternalUsers={workOrder.assignableInternalUsers}
                assignedContractorLabel={assignedContractorLabel}
                contractorOrganizationId={contractorOrganizationId}
                currentStatus={currentStatus}
                dueDate={workOrder.dueDate}
                internalAssignees={workOrder.internalAssignees}
                internalAssignmentMessage={internalAssignmentMessage}
                internalAssignmentTone={internalAssignmentTone}
                isMutatingAssignment={isMutatingAssignment}
                isSavingInternalAssignment={isSavingInternalAssignment}
                isUpdatingStatus={isUpdatingStatus}
                notes={workOrder.notes}
                onAcceptAssignment={() =>
                  void handleAssignmentMutation(
                    `/api/work-orders/${workOrder.id}/assignments/${workOrder.activeAssignment?.id}/accept`,
                  )
                }
                onAssignmentNotesChange={setAssignmentNotes}
                onCompleteAssignment={() =>
                  void handleAssignmentMutation(
                    `/api/work-orders/${workOrder.id}/assignments/${workOrder.activeAssignment?.id}/complete`,
                    { notes: assignmentNotes.trim() || null },
                  )
                }
                onContractorOrganizationIdChange={setContractorOrganizationId}
                onDeclineAssignment={() =>
                  void handleAssignmentMutation(
                    `/api/work-orders/${workOrder.id}/assignments/${workOrder.activeAssignment?.id}/decline`,
                    { notes: assignmentNotes.trim() || null },
                  )
                }
                onNotesChange={(notes) => {
                  setWorkOrder((currentWorkOrder) =>
                    currentWorkOrder
                      ? {
                          ...currentWorkOrder,
                          notes,
                        }
                      : currentWorkOrder,
                  );
                }}
                onSaveContractorAssignment={() => void handleAssignOrReassign()}
                onSaveInternalAssignment={() =>
                  void handleSaveInternalAssignment()
                }
                onScheduledDateChange={setScheduledDate}
                onSelectedCoordinatorUserIdChange={setSelectedCoordinatorUserId}
                onSelectedManagerUserIdChange={setSelectedManagerUserId}
                onStatusChange={handleStatusChange}
                onTimeWindowEndChange={setTimeWindowEnd}
                onTimeWindowStartChange={setTimeWindowStart}
                pendingStatus={pendingStatus}
                requestedServiceDate={workOrder.requestedServiceDate}
                scheduledDate={scheduledDate}
                canAddNote={workOrder.allowedActions.canAddNote}
                selectedCoordinatorUserId={selectedCoordinatorUserId}
                selectedManagerUserId={selectedManagerUserId}
                statusMessage={statusMessage}
                statusTone={statusTone}
                timeWindowEnd={timeWindowEnd}
                timeWindowStart={timeWindowStart}
                workOrderId={workOrder.id}
              />
            ) : null}

            {activeTab === "quotes-finance" ? (
              <WorkOrderFinanceTab
                onFinanceUpdated={() => loadWorkOrderDetail({ silent: true })}
                quoteRequiredThresholdCents={
                  workOrder.quoteRequiredThresholdCents
                }
                requiresQuote={workOrder.requiresQuote}
                showFinancePanel={workOrder.sectionVisibility.showFinancePanel}
                workOrderId={workOrder.id}
                workOrderStatus={currentStatus}
              />
            ) : null}

            {activeTab === "communications" ? (
              <WorkOrderCommunicationsTab
                assignedContractorLabel={assignedContractorLabel}
                assignments={workOrder.assignments}
                canAddNote={workOrder.allowedActions.canAddNote}
                notes={workOrder.notes}
                onNotesChange={(notes) => {
                  setWorkOrder((currentWorkOrder) =>
                    currentWorkOrder
                      ? {
                          ...currentWorkOrder,
                          notes,
                        }
                      : currentWorkOrder,
                  );
                }}
                timeline={workOrder.timeline}
                workOrderId={workOrder.id}
              />
            ) : null}

            {activeTab === "files" ? (
              <WorkOrderFilesTab
                attachments={workOrder.attachments}
                canAddAttachment={workOrder.allowedActions.canAddAttachment}
                onAttachmentsChange={(attachments) => {
                  setWorkOrder((currentWorkOrder) =>
                    currentWorkOrder
                      ? {
                          ...currentWorkOrder,
                          attachments,
                        }
                      : currentWorkOrder,
                  );
                }}
                workOrderId={workOrder.id}
              />
            ) : null}

            {activeTab === "history-audit" ? (
              <WorkOrderHistoryAuditTab
                assignments={workOrder.assignments}
                attachments={workOrder.attachments}
                currentStatus={currentStatus}
                notes={workOrder.notes}
                timeline={workOrder.timeline}
                updatedAt={workOrder.updatedAt}
                workOrderId={workOrder.id}
              />
            ) : null}
          </div>
        </section>

        <aside className="min-w-0">
          <WorkOrderSidebar
            clientDisplayName={clientDisplayName}
            clientId={workOrder.clientOrganizationId}
            coordinatorLabel={coordinatorLabel}
            createdAtLabel={formatDateTime(workOrder.createdAt)}
            dueDateLabel={formatDate(workOrder.dueDate)}
            locationCode={workOrder.related.location.code}
            locationId={workOrder.locationId}
            locationName={
              workOrder.related.location.name ?? workOrder.locationId
            }
            managerLabel={managerLabel}
            priorityLabel={WORK_ORDER_PRIORITY_LABELS[workOrder.priority]}
            quoteRequirementLabel={quoteRequirementLabel}
            quoteThresholdLabel={quoteThresholdLabel}
            requestedByEmail={workOrder.requestedByEmail}
            requestedByName={workOrder.requestedByName}
            requestedByPhone={workOrder.requestedByPhone}
            requestedServiceDateLabel={formatDate(
              workOrder.requestedServiceDate,
            )}
            requesterContact={requesterContact}
            siteContact={siteContact}
            statusLabel={currentStatusLabel}
            updatedAtLabel={formatDateTime(workOrder.updatedAt)}
          />
        </aside>
      </div>
    </section>
  );
}

function BackLink() {
  return (
    <Link
      className="inline-flex text-sm font-medium text-neutral-600 underline-offset-4 hover:text-neutral-950 hover:underline"
      href="/dashboard/work-orders"
    >
      Back to work orders
    </Link>
  );
}

function WorkOrderDetailState({
  title,
  description,
  tone,
}: {
  title: string;
  description: string;
  tone: "neutral" | "error";
}) {
  return (
    <section className="space-y-4">
      <BackLink />
      <section
        className={
          tone === "error"
            ? "border border-rose-200 bg-rose-50 p-5"
            : "border border-neutral-200 bg-white p-5"
        }
      >
        <h1
          className={
            tone === "error"
              ? "text-2xl font-semibold tracking-tight text-rose-900"
              : "text-2xl font-semibold tracking-tight text-neutral-950"
          }
        >
          {title}
        </h1>
        <p
          className={
            tone === "error"
              ? "mt-3 max-w-2xl text-sm leading-6 text-rose-800"
              : "mt-3 max-w-2xl text-sm leading-6 text-neutral-600"
          }
        >
          {description}
        </p>
      </section>
    </section>
  );
}

function WorkOrderDetailLoadingState() {
  return (
    <section className="space-y-4">
      <div className="h-6 w-40 animate-pulse rounded-xl bg-neutral-200" />
      <div className="h-48 animate-pulse border border-neutral-200 bg-neutral-100" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
        <div className="space-y-4">
          <div className="h-56 animate-pulse border border-neutral-200 bg-neutral-100" />
          <div className="h-64 animate-pulse border border-neutral-200 bg-neutral-100" />
          <div className="h-56 animate-pulse border border-neutral-200 bg-neutral-100" />
        </div>
        <div className="space-y-4">
          <div className="h-48 animate-pulse border border-neutral-200 bg-neutral-100" />
          <div className="h-40 animate-pulse border border-neutral-200 bg-neutral-100" />
        </div>
      </div>
    </section>
  );
}

function mapResponseStatusToPageState(statusCode: number): PageState {
  if (statusCode === 403) {
    return "forbidden";
  }

  if (statusCode === 404) {
    return "not_found";
  }

  return "error";
}

function formatQuoteThreshold(value: number | null): string {
  if (value == null) {
    return "Not set";
  }

  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
  }).format(value / 100);
}

const statusBadgeClassNames = {
  new: "border-sky-200 bg-sky-50 text-sky-800",
  triage: "border-cyan-200 bg-cyan-50 text-cyan-800",
  assigned: "border-violet-200 bg-violet-50 text-violet-800",
  awaiting_contractor_response:
    "border-indigo-200 bg-indigo-50 text-indigo-800",
  quote_required: "border-amber-200 bg-amber-50 text-amber-900",
  contractor_quote_received: "border-teal-200 bg-teal-50 text-teal-800",
  quote_under_review: "border-lime-200 bg-lime-50 text-lime-900",
  client_approval_requested: "border-yellow-200 bg-yellow-50 text-yellow-900",
  client_approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
  contractor_scheduled: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-800",
  in_progress: "border-amber-200 bg-amber-50 text-amber-900",
  work_completed: "border-green-200 bg-green-50 text-green-800",
  completion_review: "border-blue-200 bg-blue-50 text-blue-800",
  ready_for_invoicing: "border-sky-200 bg-sky-50 text-sky-900",
  invoiced: "border-cyan-200 bg-cyan-50 text-cyan-900",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-900",
  closed: "border-neutral-300 bg-neutral-100 text-neutral-700",
  on_hold: "border-stone-300 bg-stone-100 text-stone-700",
  escalated: "border-rose-200 bg-rose-50 text-rose-900",
  cancelled: "border-rose-200 bg-rose-50 text-rose-800",
} as const satisfies Record<WorkOrderStatus, string>;

const priorityBadgeClassNames = {
  LOW: "border-neutral-300 bg-white text-neutral-700",
  MEDIUM: "border-sky-200 bg-sky-50 text-sky-800",
  HIGH: "border-amber-200 bg-amber-50 text-amber-900",
  URGENT: "border-rose-200 bg-rose-50 text-rose-800",
} as const satisfies Record<WorkOrderPriority, string>;

function getApiErrorMessage(
  payload:
    | WorkOrderDetailSuccessResponse
    | WorkOrderStatusSuccessResponse
    | ApiErrorResponse,
  fallback: string,
): string {
  if ("error" in payload && payload.error?.message) {
    return payload.error.message;
  }

  return fallback;
}

function toDateInputValue(value: string | null): string {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function toDateTimeLocalValue(value: string | null): string {
  if (!value) {
    return "";
  }

  return value.slice(0, 16);
}

function toIsoStringOrNull(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}
