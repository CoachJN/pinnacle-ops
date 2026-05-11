import type { WorkOrderStatus } from "@/modules/work-orders";

export interface WorkOrderTimelineActor {
  actorType: string;
  displayName: string | null;
}

export interface WorkOrderTimelineEntity {
  entityType: string;
  label: string | null;
}

export interface WorkOrderTimelineEntry {
  id: string;
  occurredAt: string;
  type: string;
  summary: string;
  actor: WorkOrderTimelineActor;
  entity: WorkOrderTimelineEntity;
}

export interface WorkOrderNoteSnapshot {
  id: string;
  body: string;
  authorDisplayName: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkOrderAttachmentSnapshot {
  id: string;
  fileName: string;
  uploadedByDisplayName: string;
  createdAt: string;
}

export interface WorkOrderAssignmentSnapshot {
  id: string;
  assigneeDisplayName: string;
  status: "assigned" | "accepted" | "declined" | "completed" | "cancelled";
  assignedAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  completedAt: string | null;
}

export interface WorkOrderOperationalSummaryInput {
  status: WorkOrderStatus;
  createdAt: string;
  dueDate: string | null;
  closedAt: string | null;
  requiresQuote: boolean;
  assignedContractorLabel: string;
  coordinatorLabel: string;
  managerLabel: string;
  activeAssignmentStatus: WorkOrderAssignmentSnapshot["status"] | null;
  now?: string;
}

export interface DerivedWorkOrderNextAction {
  label: string;
  detail: string;
  tone: "neutral" | "warning" | "danger" | "success";
}

export interface DerivedWorkOrderOperationalSummary {
  ageInDays: number;
  ageLabel: string;
  isClosed: boolean;
  isOverdue: boolean;
  nextAction: DerivedWorkOrderNextAction;
  riskLabel: string | null;
  ownershipWarning: string | null;
}

export interface RecentActivityItem {
  id: string;
  detail: string;
  occurredAt: string;
  source: "timeline" | "note" | "attachment" | "assignment";
  targetTab: "communications" | "files" | "history-audit";
  title: string;
}

export function deriveWorkOrderOperationalSummary(
  input: WorkOrderOperationalSummaryInput,
): DerivedWorkOrderOperationalSummary {
  const now = input.now ? new Date(input.now) : new Date();
  const createdAt = new Date(input.createdAt);
  const closedAt = input.closedAt ? new Date(input.closedAt) : null;
  const dueAt = input.dueDate ? new Date(input.dueDate) : null;
  const end = closedAt ?? now;
  const ageInDays = Math.max(
    0,
    Math.floor((end.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const isClosed = TERMINAL_STATUSES.has(input.status);
  const isOverdue =
    dueAt !== null &&
    !isClosed &&
    dueAt.getTime() < now.getTime();

  return {
    ageInDays,
    ageLabel: formatAgeLabel(ageInDays),
    isClosed,
    isOverdue,
    nextAction: deriveWorkOrderNextAction({
      activeAssignmentStatus: input.activeAssignmentStatus,
      assignedContractorLabel: input.assignedContractorLabel,
      coordinatorLabel: input.coordinatorLabel,
      isOverdue,
      managerLabel: input.managerLabel,
      requiresQuote: input.requiresQuote,
      status: input.status,
    }),
    riskLabel: deriveRiskLabel(input.status, isOverdue),
    ownershipWarning: deriveOwnershipWarning(input),
  };
}

export function buildWorkOrderRecentActivitySnapshot(input: {
  assignments: WorkOrderAssignmentSnapshot[];
  attachments: WorkOrderAttachmentSnapshot[];
  notes: WorkOrderNoteSnapshot[];
  timeline: WorkOrderTimelineEntry[];
  limit?: number;
}): RecentActivityItem[] {
  const limit = input.limit ?? 5;

  if (input.timeline.length > 0) {
    return [...input.timeline]
      .sort(compareRecentFirst)
      .slice(0, limit)
      .map((entry) => ({
        id: entry.id,
        detail: buildTimelineDetail(entry),
        occurredAt: entry.occurredAt,
        source: "timeline",
        targetTab: getTimelineTargetTab(entry),
        title: entry.summary,
      }));
  }

  return [
    ...input.notes.map<RecentActivityItem>((note) => ({
      id: note.id,
      detail: `Note added by ${note.authorDisplayName}`,
      occurredAt: note.updatedAt,
      source: "note",
      targetTab: "communications",
      title: truncate(note.body),
    })),
    ...input.attachments.map<RecentActivityItem>((attachment) => ({
      id: attachment.id,
      detail: `Attachment uploaded by ${attachment.uploadedByDisplayName}`,
      occurredAt: attachment.createdAt,
      source: "attachment",
      targetTab: "files",
      title: attachment.fileName,
    })),
    ...input.assignments.map<RecentActivityItem>((assignment) => ({
      id: assignment.id,
      detail: `Assignment ${assignment.status.replaceAll("_", " ")} for ${assignment.assigneeDisplayName}`,
      occurredAt:
        assignment.completedAt ??
        assignment.declinedAt ??
        assignment.acceptedAt ??
        assignment.assignedAt,
      source: "assignment",
      targetTab: "history-audit",
      title: "Assignment update",
    })),
  ]
    .sort(compareRecentFirst)
    .slice(0, limit);
}

function deriveWorkOrderNextAction(input: {
  activeAssignmentStatus: WorkOrderAssignmentSnapshot["status"] | null;
  assignedContractorLabel: string;
  coordinatorLabel: string;
  isOverdue: boolean;
  managerLabel: string;
  requiresQuote: boolean;
  status: WorkOrderStatus;
}): DerivedWorkOrderNextAction {
  if (input.status === "escalated") {
    return {
      label: "Escalated",
      detail: "Operational attention is required before standard workflow can resume.",
      tone: "danger",
    };
  }

  if (input.status === "on_hold") {
    return {
      label: "On hold",
      detail: "Work is paused until the current hold condition is cleared.",
      tone: "warning",
    };
  }

  if (input.isOverdue) {
    return {
      label: "Overdue",
      detail: "The due date has passed and the work order is still open.",
      tone: "danger",
    };
  }

  if (input.status === "client_approval_requested") {
    return {
      label: "Awaiting client approval",
      detail: "A client-facing approval decision is still pending.",
      tone: "warning",
    };
  }

  if (
    input.requiresQuote &&
    QUOTE_REQUIRED_STATUSES.has(input.status)
  ) {
    return {
      label: "Quote required",
      detail: "Quote workflow should be completed before execution continues.",
      tone: "warning",
    };
  }

  if (input.status === "ready_for_invoicing") {
    return {
      label: "Ready for invoicing",
      detail: "Finance can begin invoice creation from the Quotes & Finance tab.",
      tone: "success",
    };
  }

  if (
    input.assignedContractorLabel === "Unassigned" ||
    input.activeAssignmentStatus === null
  ) {
    return {
      label: "Assign a contractor",
      detail: "No active contractor assignment is currently attached to this work order.",
      tone: "warning",
    };
  }

  if (input.status === "contractor_scheduled") {
    return {
      label: "Move to in progress",
      detail: "The visit is scheduled and field work can begin when execution starts.",
      tone: "neutral",
    };
  }

  if (
    input.coordinatorLabel === "Unassigned" ||
    input.managerLabel === "Unassigned"
  ) {
    return {
      label: "Confirm internal ownership",
      detail: "Internal coordinator and manager coverage should be completed.",
      tone: "warning",
    };
  }

  return {
    label: "No current blocker",
    detail: "The work order is progressing without an obvious operational blocker.",
    tone: "success",
  };
}

function deriveRiskLabel(
  status: WorkOrderStatus,
  isOverdue: boolean,
): string | null {
  if (status === "escalated") {
    return "Escalated";
  }

  if (status === "on_hold") {
    return "On hold";
  }

  if (isOverdue) {
    return "Overdue";
  }

  return null;
}

function deriveOwnershipWarning(
  input: Pick<
    WorkOrderOperationalSummaryInput,
    "assignedContractorLabel" | "coordinatorLabel" | "managerLabel" | "status"
  >,
): string | null {
  if (TERMINAL_STATUSES.has(input.status)) {
    return null;
  }

  const missingOwners = [
    input.coordinatorLabel === "Unassigned" ? "coordinator" : null,
    input.managerLabel === "Unassigned" ? "manager" : null,
    input.assignedContractorLabel === "Unassigned" ? "contractor" : null,
  ].filter(Boolean);

  if (missingOwners.length === 0) {
    return null;
  }

  if (missingOwners.length === 1) {
    return `Missing ${missingOwners[0]} assignment.`;
  }

  return `Missing ${missingOwners.slice(0, -1).join(", ")} and ${missingOwners.at(-1)} assignments.`;
}

function buildTimelineDetail(entry: WorkOrderTimelineEntry): string {
  const actorLabel =
    entry.actor.displayName ??
    (entry.actor.actorType === "system" ? "System" : "Unknown actor");
  const entityLabel = entry.entity.label ? ` • ${entry.entity.label}` : "";
  return `${actorLabel}${entityLabel}`;
}

function getTimelineTargetTab(
  entry: WorkOrderTimelineEntry,
): RecentActivityItem["targetTab"] {
  if (entry.type.startsWith("communication_") || entry.type === "note_added") {
    return "communications";
  }

  if (entry.type === "attachment_added") {
    return "files";
  }

  return "history-audit";
}

function compareRecentFirst(
  left: { occurredAt: string },
  right: { occurredAt: string },
): number {
  return new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime();
}

function formatAgeLabel(ageInDays: number): string {
  if (ageInDays <= 0) {
    return "Opened today";
  }

  if (ageInDays === 1) {
    return "1 day open";
  }

  return `${ageInDays} days open`;
}

function truncate(value: string): string {
  const normalized = value.trim();
  if (normalized.length <= 96) {
    return normalized;
  }

  return `${normalized.slice(0, 93)}...`;
}

const TERMINAL_STATUSES = new Set<WorkOrderStatus>(["closed", "cancelled"]);

const QUOTE_REQUIRED_STATUSES = new Set<WorkOrderStatus>([
  "new",
  "triage",
  "assigned",
  "awaiting_contractor_response",
  "quote_required",
  "contractor_quote_received",
  "quote_under_review",
]);
