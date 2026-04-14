"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActionFeedback } from "@/components/shared/action-feedback";
import {
  WORK_ORDER_CATEGORY_LABELS,
  WORK_ORDER_PRIORITY_LABELS,
  WORK_ORDER_STATUS_LABELS,
  type WorkOrderCategory,
  type WorkOrderPriority,
  type WorkOrderStatus,
} from "@/modules/work-orders";
import { AssignmentPanel } from "./assignment-panel";
import { formatDate, formatDateTime } from "./formatting";
import { WorkOrderAttachmentsPanel } from "./work-order-attachments-panel";
import { WorkOrderClientLocationPanel } from "./work-order-client-location-panel";
import { WorkOrderDetailHeader } from "./work-order-detail-header";
import { WorkOrderNotesPanel } from "./work-order-notes-panel";
import { WorkOrderOverviewPanel } from "./work-order-overview-panel";
import { WorkOrderQuotePanel } from "./work-order-quote-panel";
import { WorkOrderRequesterPanel } from "./work-order-requester-panel";
import { WorkOrderFinancePanel } from "./work-order-finance-panel";

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

interface WorkOrderAttachmentItem {
  id: string;
  workOrderId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedBy: string;
  uploadedByDisplayName: string;
  createdAt: string;
  accessPath: string;
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
  serviceCategories: string[];
  isAssignable: boolean;
  reason: string | null;
}

interface InternalAssignees {
  coordinator: AssignableUser | null;
  manager: AssignableUser | null;
}

interface WorkOrderDetailRecord {
  id: string;
  workOrderNumber: string;
  title: string;
  description: string;
  clientOrganizationId: string;
  locationId: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  category: WorkOrderCategory;
  requestedByName: string;
  requestedByEmail: string | null;
  requestedByPhone: string | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  closedAt: string | null;
  related: RelatedSummary;
  notes: WorkOrderNoteItem[];
  attachments: WorkOrderAttachmentItem[];
  assignments: AssignmentItem[];
  activeAssignment: AssignmentItem | null;
  activeAssignmentId: string | null;
  internalAssignees: InternalAssignees;
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

export function WorkOrderDetailPage({
  workOrderId,
}: WorkOrderDetailPageProps) {
  const router = useRouter();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [workOrder, setWorkOrder] = useState<WorkOrderDetailRecord | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [statusTone, setStatusTone] = useState<"success" | "error" | "info">(
    "info",
  );
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<WorkOrderStatus | null>(null);
  const [assignmentMessage, setAssignmentMessage] = useState<string | null>(null);
  const [assignmentTone, setAssignmentTone] = useState<"success" | "error" | "info">(
    "info",
  );
  const [isMutatingAssignment, setIsMutatingAssignment] = useState(false);
  const [internalAssignmentMessage, setInternalAssignmentMessage] = useState<string | null>(null);
  const [internalAssignmentTone, setInternalAssignmentTone] = useState<
    "success" | "error" | "info"
  >("info");
  const [isSavingInternalAssignment, setIsSavingInternalAssignment] = useState(false);
  const [contractorOrganizationId, setContractorOrganizationId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [timeWindowStart, setTimeWindowStart] = useState("");
  const [timeWindowEnd, setTimeWindowEnd] = useState("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [selectedCoordinatorUserId, setSelectedCoordinatorUserId] = useState("");
  const [selectedManagerUserId, setSelectedManagerUserId] = useState("");

  async function loadWorkOrderDetail(options: { silent?: boolean } = {}) {
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
        getApiErrorMessage(errorPayload, "Unable to load work order details."),
      );
    }

    const successPayload = payload as WorkOrderDetailSuccessResponse;
    const nextWorkOrder = successPayload.data?.workOrder ?? null;
    if (!nextWorkOrder) {
      setPageState("error");
      throw new Error("Work order details were returned in an unexpected format.");
    }

    setWorkOrder(nextWorkOrder);
    setContractorOrganizationId(
      nextWorkOrder.activeAssignment?.contractorOrganizationId ?? "",
    );
    setScheduledDate(toDateInputValue(nextWorkOrder.activeAssignment?.scheduledDate ?? null));
    setTimeWindowStart(
      toDateTimeLocalValue(nextWorkOrder.activeAssignment?.timeWindowStart ?? null),
    );
    setTimeWindowEnd(
      toDateTimeLocalValue(nextWorkOrder.activeAssignment?.timeWindowEnd ?? null),
    );
    setAssignmentNotes(nextWorkOrder.activeAssignment?.notes ?? "");
    setSelectedCoordinatorUserId(
      nextWorkOrder.internalAssignees.coordinator?.id ?? "",
    );
    setSelectedManagerUserId(
      nextWorkOrder.internalAssignees.manager?.id ?? "",
    );
    setPageState("ready");
  }

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
  }, [workOrderId]);

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

      setWorkOrder(updatedWorkOrder);
      setStatusTone("success");
      setStatusMessage(
        `Status updated to ${WORK_ORDER_STATUS_LABELS[updatedWorkOrder.status]}.`,
      );
      router.refresh();
    } catch (error) {
      setStatusTone("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Unable to update work order status.",
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
        throw new Error(getApiErrorMessage(payload, "Unable to update assignment."));
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
      setScheduledDate(toDateInputValue(updatedWorkOrder.activeAssignment?.scheduledDate ?? null));
      setTimeWindowStart(
        toDateTimeLocalValue(updatedWorkOrder.activeAssignment?.timeWindowStart ?? null),
      );
      setTimeWindowEnd(
        toDateTimeLocalValue(updatedWorkOrder.activeAssignment?.timeWindowEnd ?? null),
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
      const response = await fetch(`/api/work-orders/${workOrder.id}/assign-internal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assignedCoordinatorUserId: selectedCoordinatorUserId || null,
          assignedManagerUserId: selectedManagerUserId || null,
        }),
      });
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
        throw new Error("Internal assignment update returned an unexpected response.");
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

  return (
    <section className="space-y-6">
      <BackLink />

      <WorkOrderDetailHeader
        allowedTransitions={workOrder.allowedTransitions}
        categoryLabel={WORK_ORDER_CATEGORY_LABELS[workOrder.category]}
        createdAtLabel={formatDateTime(workOrder.createdAt)}
        dueDateLabel={formatDate(workOrder.dueDate)}
        isUpdatingStatus={isUpdatingStatus}
        onStatusChange={handleStatusChange}
        pendingStatus={pendingStatus}
        priorityLabel={WORK_ORDER_PRIORITY_LABELS[workOrder.priority]}
        status={workOrder.status}
        statusActionEnabled={workOrder.allowedActions.canUpdateStatus}
        statusLabel={WORK_ORDER_STATUS_LABELS[workOrder.status]}
        statusMessage={statusMessage}
        statusTone={statusTone}
        updatedAtLabel={formatDateTime(workOrder.updatedAt)}
        workOrderNumber={workOrder.workOrderNumber}
        workOrderTitle={workOrder.title}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,1fr)]">
        <section className="space-y-6">
          <WorkOrderOverviewPanel
            categoryLabel={WORK_ORDER_CATEGORY_LABELS[workOrder.category]}
            createdAtLabel={formatDateTime(workOrder.createdAt)}
            description={workOrder.description}
            dueDateLabel={formatDate(workOrder.dueDate)}
            closedAtLabel={formatDateTime(workOrder.closedAt)}
            priorityLabel={WORK_ORDER_PRIORITY_LABELS[workOrder.priority]}
            statusLabel={WORK_ORDER_STATUS_LABELS[workOrder.status]}
            updatedAtLabel={formatDateTime(workOrder.updatedAt)}
          />

          <WorkOrderQuotePanel workOrderId={workOrder.id} />

          <WorkOrderFinancePanel
            onFinanceUpdated={() => loadWorkOrderDetail({ silent: true })}
            workOrderStatus={workOrder.status}
            workOrderId={workOrder.id}
          />

          <AssignmentPanel
            activeAssignment={workOrder.activeAssignment}
            allowedActions={workOrder.allowedActions}
            assignmentMessage={assignmentMessage}
            assignmentNotes={assignmentNotes}
            assignments={workOrder.assignments}
            assignmentTone={assignmentTone}
            assignableContractors={workOrder.assignableContractors}
            assignableInternalUsers={workOrder.assignableInternalUsers}
            contractorOrganizationId={contractorOrganizationId}
            internalAssignees={workOrder.internalAssignees}
            internalAssignmentMessage={internalAssignmentMessage}
            internalAssignmentTone={internalAssignmentTone}
            isMutatingAssignment={isMutatingAssignment}
            isSavingInternalAssignment={isSavingInternalAssignment}
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
            onSaveContractorAssignment={() => void handleAssignOrReassign()}
            onSaveInternalAssignment={() => void handleSaveInternalAssignment()}
            onScheduledDateChange={setScheduledDate}
            onSelectedCoordinatorUserIdChange={setSelectedCoordinatorUserId}
            onSelectedManagerUserIdChange={setSelectedManagerUserId}
            onTimeWindowEndChange={setTimeWindowEnd}
            onTimeWindowStartChange={setTimeWindowStart}
            scheduledDate={scheduledDate}
            selectedCoordinatorUserId={selectedCoordinatorUserId}
            selectedManagerUserId={selectedManagerUserId}
            timeWindowEnd={timeWindowEnd}
            timeWindowStart={timeWindowStart}
          />

          <WorkOrderNotesPanel
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
            workOrderId={workOrder.id}
          />
          <WorkOrderAttachmentsPanel
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
        </section>

        <aside className="space-y-6">
          <WorkOrderClientLocationPanel
            clientDisplayName={
              workOrder.related.clientOrganization.displayName ??
              workOrder.related.clientOrganization.name ??
              workOrder.clientOrganizationId
            }
            clientId={workOrder.clientOrganizationId}
            locationCode={workOrder.related.location.code}
            locationId={workOrder.locationId}
            locationName={workOrder.related.location.name ?? workOrder.locationId}
          />

          <WorkOrderRequesterPanel
            requesterEmail={workOrder.requestedByEmail}
            requesterName={workOrder.requestedByName}
            requesterPhone={workOrder.requestedByPhone}
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
            ? "rounded-3xl border border-rose-200 bg-rose-50 p-6 shadow-sm"
            : "rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm"
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
    <section className="space-y-6">
      <div className="h-6 w-40 animate-pulse rounded-xl bg-neutral-200" />
      <div className="h-56 animate-pulse rounded-3xl bg-neutral-100" />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(20rem,1fr)]">
        <div className="space-y-6">
          <div className="h-64 animate-pulse rounded-3xl bg-neutral-100" />
          <div className="h-72 animate-pulse rounded-3xl bg-neutral-100" />
          <div className="h-64 animate-pulse rounded-3xl bg-neutral-100" />
        </div>
        <div className="space-y-6">
          <div className="h-56 animate-pulse rounded-3xl bg-neutral-100" />
          <div className="h-48 animate-pulse rounded-3xl bg-neutral-100" />
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

function getApiErrorMessage(
  payload: WorkOrderDetailSuccessResponse | WorkOrderStatusSuccessResponse | ApiErrorResponse,
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
