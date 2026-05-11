import {
  WORK_ORDER_STATUS_LABELS,
  type WorkOrderStatus,
} from "@/modules/work-orders";
import type {
  WorkOrderAssignmentSnapshot,
  WorkOrderTimelineEntry,
} from "./work-order-display-model";

export type WorkflowStageId =
  | "requested"
  | "assigned"
  | "quote_required"
  | "in_progress"
  | "exception"
  | "completion_review"
  | "ready_for_invoicing"
  | "closed";

export type WorkflowStageState = "completed" | "current" | "upcoming" | "blocked";
export type WorkflowActionGroup = "primary" | "exception" | "terminal" | "destructive";

export interface WorkflowStageItem {
  id: WorkflowStageId;
  label: string;
  state: WorkflowStageState;
}

export interface DerivedWorkOrderWorkflowStage {
  currentStageId: WorkflowStageId | null;
  currentStageLabel: string;
  isException: boolean;
  isFallback: boolean;
  stages: WorkflowStageItem[];
  statusLabel: string;
}

export interface WorkflowActionItem {
  status: WorkOrderStatus;
  label: string;
  detail: string;
  group: WorkflowActionGroup;
}

export interface DerivedWorkflowActions {
  all: WorkflowActionItem[];
  primary: WorkflowActionItem[];
  exception: WorkflowActionItem[];
  terminal: WorkflowActionItem[];
  destructive: WorkflowActionItem[];
}

export interface WorkflowSchedulingSummary {
  requestedServiceDate: string | null;
  dueDate: string | null;
  scheduledDate: string | null;
  timeWindowStart: string | null;
  timeWindowEnd: string | null;
  activeAssignmentStatus: WorkOrderAssignmentSnapshot["status"] | null;
  hasActiveAssignment: boolean;
  schedulingStatusLabel: string;
  schedulingMessage: string;
}

export interface WorkflowHistoryItem {
  id: string;
  detail: string;
  occurredAt: string;
  title: string;
}

const STAGE_ORDER: readonly { id: WorkflowStageId; label: string }[] = [
  { id: "requested", label: "Requested" },
  { id: "assigned", label: "Assigned" },
  { id: "quote_required", label: "Quote Required" },
  { id: "in_progress", label: "In Progress" },
  { id: "exception", label: "On Hold / Escalated" },
  { id: "completion_review", label: "Completion Review" },
  { id: "ready_for_invoicing", label: "Ready for Invoicing" },
  { id: "closed", label: "Closed / Cancelled" },
] as const;

const STAGE_INDEX_BY_ID = Object.fromEntries(
  STAGE_ORDER.map((stage, index) => [stage.id, index]),
) as Record<WorkflowStageId, number>;

const STAGE_BY_STATUS = {
  new: "requested",
  triage: "requested",
  assigned: "assigned",
  awaiting_contractor_response: "assigned",
  client_approved: "assigned",
  contractor_scheduled: "assigned",
  quote_required: "quote_required",
  contractor_quote_received: "quote_required",
  quote_under_review: "quote_required",
  client_approval_requested: "quote_required",
  in_progress: "in_progress",
  on_hold: "exception",
  escalated: "exception",
  work_completed: "completion_review",
  completion_review: "completion_review",
  ready_for_invoicing: "ready_for_invoicing",
  invoiced: "ready_for_invoicing",
  paid: "ready_for_invoicing",
  closed: "closed",
  cancelled: "closed",
} as const satisfies Partial<Record<WorkOrderStatus, WorkflowStageId>>;

const ACTION_DETAILS = {
  new: "Keep the work order in the requested intake state.",
  triage: "Move this work order into active intake and operational review.",
  assigned: "Return the work order to an assignment-ready state.",
  awaiting_contractor_response:
    "Keep the work order waiting on contractor acknowledgement or availability.",
  quote_required: "Route the work order into the quote workflow before execution continues.",
  contractor_quote_received:
    "Record that a contractor quote is back and ready for internal review.",
  quote_under_review: "Move the work order into internal quote review.",
  client_approval_requested: "Send the quote package into client approval.",
  client_approved: "Confirm client approval so execution can proceed.",
  contractor_scheduled: "Mark the job as scheduled for field execution.",
  in_progress: "Move the work order into active field execution.",
  work_completed: "Record that on-site work is complete and ready for review.",
  completion_review: "Move the work order into internal completion review.",
  ready_for_invoicing: "Confirm operational completion so finance can prepare invoicing.",
  invoiced: "Record that an invoice has been issued.",
  paid: "Record that payment has been received.",
  closed: "Close this work order once all operational and finance steps are complete.",
  on_hold: "Pause the workflow until the blocking condition is resolved.",
  escalated: "Escalate this work order for operational attention.",
  cancelled: "Cancel this work order. This is a destructive action.",
} as const satisfies Record<WorkOrderStatus, string>;

export function deriveWorkOrderWorkflowStage(
  status: WorkOrderStatus,
): DerivedWorkOrderWorkflowStage {
  const currentStageId = STAGE_BY_STATUS[status] ?? null;
  const currentIndex =
    currentStageId === null ? null : STAGE_INDEX_BY_ID[currentStageId];
  const isException = currentStageId === "exception";

  return {
    currentStageId,
    currentStageLabel: currentStageId
      ? STAGE_ORDER[STAGE_INDEX_BY_ID[currentStageId]].label
      : "Workflow status needs mapping",
    isException,
    isFallback: currentStageId === null,
    stages: STAGE_ORDER.map((stage, index) => ({
      id: stage.id,
      label: stage.label,
      state: deriveStageState({
        currentIndex,
        currentStageId,
        index,
        stageId: stage.id,
      }),
    })),
    statusLabel: WORK_ORDER_STATUS_LABELS[status] ?? status.replaceAll("_", " "),
  };
}

export function deriveWorkflowActions(input: {
  allowedTransitions: readonly WorkOrderStatus[];
  statusActionEnabled: boolean;
}): DerivedWorkflowActions {
  if (!input.statusActionEnabled || input.allowedTransitions.length === 0) {
    return {
      all: [],
      primary: [],
      exception: [],
      terminal: [],
      destructive: [],
    };
  }

  const all = input.allowedTransitions.map((status) => ({
    status,
    label: deriveActionLabel(status),
    detail: ACTION_DETAILS[status],
    group: deriveActionGroup(status),
  }));

  return {
    all,
    primary: all.filter((action) => action.group === "primary"),
    exception: all.filter((action) => action.group === "exception"),
    terminal: all.filter((action) => action.group === "terminal"),
    destructive: all.filter((action) => action.group === "destructive"),
  };
}

export function deriveWorkflowSchedulingSummary(input: {
  activeAssignmentStatus: WorkOrderAssignmentSnapshot["status"] | null;
  dueDate: string | null;
  requestedServiceDate: string | null;
  scheduledDate: string | null;
  timeWindowEnd: string | null;
  timeWindowStart: string | null;
}): WorkflowSchedulingSummary {
  const hasActiveAssignment = input.activeAssignmentStatus !== null;
  const isScheduled = Boolean(
    input.scheduledDate || input.timeWindowStart || input.timeWindowEnd,
  );

  return {
    requestedServiceDate: input.requestedServiceDate,
    dueDate: input.dueDate,
    scheduledDate: input.scheduledDate,
    timeWindowStart: input.timeWindowStart,
    timeWindowEnd: input.timeWindowEnd,
    activeAssignmentStatus: input.activeAssignmentStatus,
    hasActiveAssignment,
    schedulingStatusLabel: hasActiveAssignment
      ? (input.activeAssignmentStatus ?? "assigned").replaceAll("_", " ")
      : "No active contractor assignment",
    schedulingMessage: isScheduled
      ? "Scheduling details are attached to the active assignment."
      : hasActiveAssignment
        ? "An assignment exists, but no schedule has been confirmed yet."
        : "Create a contractor assignment before scheduling work.",
  };
}

export function buildWorkflowHistorySnapshot(input: {
  assignments: Array<{
    id: string;
    assigneeDisplayName: string;
    assignedByDisplayName: string;
    status: WorkOrderAssignmentSnapshot["status"];
    assignedAt: string;
    acceptedAt: string | null;
    declinedAt: string | null;
    completedAt: string | null;
  }>;
  limit?: number;
  status: WorkOrderStatus;
  timeline: WorkOrderTimelineEntry[];
  updatedAt: string;
}): WorkflowHistoryItem[] {
  const limit = input.limit ?? 5;
  const items = [
    ...input.timeline.map<WorkflowHistoryItem>((entry) => ({
      id: `timeline-${entry.id}`,
      detail: buildTimelineDetail(entry),
      occurredAt: entry.occurredAt,
      title: entry.summary,
    })),
    ...input.assignments.map<WorkflowHistoryItem>((assignment) => {
      const latestTimestamp =
        assignment.completedAt ??
        assignment.declinedAt ??
        assignment.acceptedAt ??
        assignment.assignedAt;

      return {
        id: `assignment-${assignment.id}`,
        detail: `${assignment.status.replaceAll("_", " ")} by ${assignment.assigneeDisplayName}; assigned by ${assignment.assignedByDisplayName}.`,
        occurredAt: latestTimestamp,
        title: `Assignment ${assignment.status.replaceAll("_", " ")}`,
      };
    }),
    {
      id: `status-${input.status}-${input.updatedAt}`,
      detail: `Current lifecycle status is ${WORK_ORDER_STATUS_LABELS[input.status]}.`,
      occurredAt: input.updatedAt,
      title: "Status snapshot",
    },
  ];

  return items.sort(compareRecentFirst).slice(0, limit);
}

function deriveStageState(input: {
  currentIndex: number | null;
  currentStageId: WorkflowStageId | null;
  index: number;
  stageId: WorkflowStageId;
}): WorkflowStageState {
  if (input.currentIndex === null || input.currentStageId === null) {
    return "upcoming";
  }

  if (input.stageId === input.currentStageId) {
    return "current";
  }

  if (input.currentStageId === "exception" && input.index > input.currentIndex) {
    return "blocked";
  }

  return input.index < input.currentIndex ? "completed" : "upcoming";
}

function deriveActionLabel(status: WorkOrderStatus): string {
  if (status === "closed") {
    return "Close work order";
  }

  if (status === "cancelled") {
    return "Cancel work order";
  }

  if (status === "on_hold") {
    return "Put on hold";
  }

  if (status === "escalated") {
    return "Escalate work order";
  }

  return `Move to ${WORK_ORDER_STATUS_LABELS[status]}`;
}

function deriveActionGroup(status: WorkOrderStatus): WorkflowActionGroup {
  if (status === "cancelled") {
    return "destructive";
  }

  if (status === "closed") {
    return "terminal";
  }

  if (status === "on_hold" || status === "escalated") {
    return "exception";
  }

  return "primary";
}

function buildTimelineDetail(entry: WorkOrderTimelineEntry): string {
  const actorLabel =
    entry.actor.displayName ??
    (entry.actor.actorType === "system" ? "System" : "Unknown actor");
  const entityLabel = entry.entity.label ? ` • ${entry.entity.label}` : "";
  return `${actorLabel}${entityLabel}`;
}

function compareRecentFirst(
  left: { occurredAt: string },
  right: { occurredAt: string },
): number {
  return new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();
}
