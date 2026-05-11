import { WORK_ORDER_STATUS_LABELS, type WorkOrderStatus } from "@/modules/work-orders";
import type { ClientInvoice } from "@/types/invoice";
import type {
  WorkOrderCommunicationMessageItem,
} from "./work-order-communication-model";
import type {
  ClientQuoteRecord,
  ContractorQuoteRecord,
} from "./work-order-financial-model";
import type {
  WorkOrderAttachmentSnapshot,
  WorkOrderNoteSnapshot,
  WorkOrderTimelineEntry,
} from "./work-order-display-model";

export type WorkOrderAuditCategory =
  | "Workflow"
  | "Assignment"
  | "Finance"
  | "Communication"
  | "File"
  | "System"
  | "Other";

export type WorkOrderAuditSourceType =
  | "timeline"
  | "assignment"
  | "contractor_quote"
  | "client_quote"
  | "invoice"
  | "note"
  | "communication"
  | "attachment"
  | "status_fallback";

export interface WorkOrderAuditAssignmentItem {
  id: string;
  assigneeType: "internal" | "contractor";
  assigneeDisplayName: string;
  assignedByDisplayName: string;
  status: "assigned" | "accepted" | "declined" | "completed" | "cancelled";
  notes: string | null;
  scheduledDate: string | null;
  timeWindowStart?: string | null;
  timeWindowEnd?: string | null;
  assignedAt: string;
  acceptedAt: string | null;
  declinedAt: string | null;
  completedAt: string | null;
}

export interface WorkOrderAuditTimelineEvent {
  id: string;
  eventLabel: string;
  category: WorkOrderAuditCategory;
  timestamp: string;
  actorLabel: string | null;
  shortDetail: string;
  sourceType: WorkOrderAuditSourceType;
}

export interface WorkOrderAuditSummary {
  totalEvents: number;
  workflowEventCount: number;
  assignmentEventCount: number;
  financialEventCount: number;
  communicationEventCount: number;
  fileEventCount: number;
  systemEventCount: number;
  otherEventCount: number;
  mostRecentEventAt: string | null;
}

export interface DerivedWorkOrderAuditModel {
  summary: WorkOrderAuditSummary;
  unifiedTimeline: WorkOrderAuditTimelineEvent[];
  statusHistory: WorkOrderAuditTimelineEvent[];
  assignmentHistory: WorkOrderAuditAssignmentItem[];
  financialHistory: WorkOrderAuditTimelineEvent[];
  communicationHistory: WorkOrderAuditTimelineEvent[];
  systemEvents: WorkOrderAuditTimelineEvent[];
}

interface DeriveWorkOrderAuditModelInput {
  assignments: WorkOrderAuditAssignmentItem[];
  attachments: WorkOrderAttachmentSnapshot[];
  clientQuotes: ClientQuoteRecord[];
  communications: WorkOrderCommunicationMessageItem[];
  contractorQuotes: ContractorQuoteRecord[];
  currentStatus: WorkOrderStatus;
  invoices: ClientInvoice[];
  notes: WorkOrderNoteSnapshot[];
  timeline: WorkOrderTimelineEntry[];
  updatedAt: string;
}

const STATUS_KEYWORDS = [
  "status",
  "lifecycle",
  "transition",
  "workflow",
  "triage",
  "approval",
  "approved",
  "progress",
  "completed",
  "review",
  "hold",
  "escalat",
  "closed",
  "cancel",
  "invoiced",
  "paid",
  "requested",
  "scheduled",
];

const ASSIGNMENT_KEYWORDS = [
  "assign",
  "assignee",
  "dispatch",
  "contractor",
  "coordinator",
  "manager",
  "schedule",
];

const FINANCE_KEYWORDS = [
  "quote",
  "invoice",
  "payment",
  "billing",
  "qbo",
  "quickbooks",
  "finance",
];

const COMMUNICATION_KEYWORDS = [
  "communication",
  "message",
  "note",
  "comment",
  "email",
  "sms",
  "call",
  "portal_message",
];

const FILE_KEYWORDS = ["attachment", "file", "document", "upload"];
const SYSTEM_KEYWORDS = ["system", "automation", "worker", "job", "sync", "cron"];

export function deriveWorkOrderAuditModel(
  input: DeriveWorkOrderAuditModelInput,
): DerivedWorkOrderAuditModel {
  const unifiedTimeline = buildUnifiedAuditTimeline(input);

  return {
    summary: deriveWorkOrderAuditSummary(unifiedTimeline),
    unifiedTimeline,
    statusHistory: deriveStatusHistory({
      currentStatus: input.currentStatus,
      timeline: input.timeline,
      unifiedTimeline,
      updatedAt: input.updatedAt,
    }),
    assignmentHistory: [...input.assignments].sort(compareAssignmentsRecentFirst),
    financialHistory: unifiedTimeline.filter((item) => item.category === "Finance"),
    communicationHistory: unifiedTimeline.filter(
      (item) => item.category === "Communication",
    ),
    systemEvents: buildSystemEvents(input.timeline),
  };
}

export function buildUnifiedAuditTimeline(
  input: Omit<DeriveWorkOrderAuditModelInput, "currentStatus" | "updatedAt">,
): WorkOrderAuditTimelineEvent[] {
  const events = [
    ...input.timeline.map(mapTimelineEvent),
    ...buildAssignmentEvents(input.assignments),
    ...input.contractorQuotes.map(mapContractorQuoteEvent),
    ...input.clientQuotes.map(mapClientQuoteEvent),
    ...input.invoices.map(mapInvoiceEvent),
    ...buildNoteEvents(input.notes, input.communications),
    ...input.communications.map(mapCommunicationEvent),
    ...input.attachments.map(mapAttachmentEvent),
  ];

  return events.sort(compareAuditEventsRecentFirst);
}

export function deriveWorkOrderAuditSummary(
  events: readonly WorkOrderAuditTimelineEvent[],
): WorkOrderAuditSummary {
  return {
    totalEvents: events.length,
    workflowEventCount: countByCategory(events, "Workflow"),
    assignmentEventCount: countByCategory(events, "Assignment"),
    financialEventCount: countByCategory(events, "Finance"),
    communicationEventCount: countByCategory(events, "Communication"),
    fileEventCount: countByCategory(events, "File"),
    systemEventCount: countByCategory(events, "System"),
    otherEventCount: countByCategory(events, "Other"),
    mostRecentEventAt: events[0]?.timestamp ?? null,
  };
}

function deriveStatusHistory(input: {
  currentStatus: WorkOrderStatus;
  timeline: WorkOrderTimelineEntry[];
  unifiedTimeline: WorkOrderAuditTimelineEvent[];
  updatedAt: string;
}): WorkOrderAuditTimelineEvent[] {
  const explicitStatusHistory = input.unifiedTimeline.filter(
    (item) => item.category === "Workflow" && item.sourceType === "timeline",
  );

  if (explicitStatusHistory.length > 0) {
    return explicitStatusHistory;
  }

  if (input.timeline.length > 0) {
    return input.timeline
      .map(mapTimelineEvent)
      .filter((item) => item.category === "Workflow" || item.category === "System");
  }

  return [
    {
      id: `status-fallback-${input.currentStatus}`,
      eventLabel: `Current status: ${WORK_ORDER_STATUS_LABELS[input.currentStatus] ?? humanize(input.currentStatus)}`,
      category: "Workflow",
      timestamp: input.updatedAt,
      actorLabel: null,
      shortDetail: "No explicit lifecycle history is available, so the current recorded status is shown.",
      sourceType: "status_fallback",
    },
  ];
}

function buildSystemEvents(
  timeline: readonly WorkOrderTimelineEntry[],
): WorkOrderAuditTimelineEvent[] {
  return timeline
    .map(mapTimelineEvent)
    .filter((item) => item.category === "System" || item.category === "Other")
    .sort(compareAuditEventsRecentFirst);
}

function buildAssignmentEvents(
  assignments: readonly WorkOrderAuditAssignmentItem[],
): WorkOrderAuditTimelineEvent[] {
  return assignments.flatMap((assignment) => {
    const events: WorkOrderAuditTimelineEvent[] = [
      {
        id: `assignment-${assignment.id}-assigned`,
        eventLabel: "Assignment created",
        category: "Assignment",
        timestamp: assignment.assignedAt,
        actorLabel: assignment.assignedByDisplayName,
        shortDetail: buildAssignmentAssignedDetail(assignment),
        sourceType: "assignment",
      },
    ];

    if (assignment.acceptedAt) {
      events.push({
        id: `assignment-${assignment.id}-accepted`,
        eventLabel: "Assignment accepted",
        category: "Assignment",
        timestamp: assignment.acceptedAt,
        actorLabel: assignment.assigneeDisplayName,
        shortDetail: `${assignment.assigneeDisplayName} accepted the assignment.`,
        sourceType: "assignment",
      });
    }

    if (assignment.declinedAt) {
      events.push({
        id: `assignment-${assignment.id}-declined`,
        eventLabel: "Assignment declined",
        category: "Assignment",
        timestamp: assignment.declinedAt,
        actorLabel: assignment.assigneeDisplayName,
        shortDetail: buildResolutionDetail("declined", assignment),
        sourceType: "assignment",
      });
    }

    if (assignment.completedAt) {
      events.push({
        id: `assignment-${assignment.id}-completed`,
        eventLabel: "Assignment completed",
        category: "Assignment",
        timestamp: assignment.completedAt,
        actorLabel: assignment.assigneeDisplayName,
        shortDetail: buildResolutionDetail("completed", assignment),
        sourceType: "assignment",
      });
    }

    return events;
  });
}

function buildNoteEvents(
  notes: readonly WorkOrderNoteSnapshot[],
  communications: readonly WorkOrderCommunicationMessageItem[],
): WorkOrderAuditTimelineEvent[] {
  const communicationIds = new Set(communications.map((item) => item.id));

  return notes
    .filter((note) => !communicationIds.has(note.id))
    .map((note) => ({
      id: `note-${note.id}`,
      eventLabel: "Internal note recorded",
      category: "Communication" as const,
      timestamp: note.updatedAt,
      actorLabel: note.authorDisplayName,
      shortDetail: truncate(note.body),
      sourceType: "note" as const,
    }));
}

function mapTimelineEvent(entry: WorkOrderTimelineEntry): WorkOrderAuditTimelineEvent {
  const actorLabel = entry.actor.displayName ?? fallbackActorLabel(entry.actor.actorType);

  return {
    id: `timeline-${entry.id}`,
    eventLabel: entry.summary,
    category: categorizeTimelineEntry(entry),
    timestamp: entry.occurredAt,
    actorLabel,
    shortDetail: buildTimelineDetail(entry),
    sourceType: "timeline",
  };
}

function mapContractorQuoteEvent(
  quote: ContractorQuoteRecord,
): WorkOrderAuditTimelineEvent {
  return {
    id: `contractor-quote-${quote.id}`,
    eventLabel: "Contractor quote update",
    category: "Finance",
    timestamp: quote.reviewedAt ?? quote.submittedAt ?? quote.updatedAt ?? quote.createdAt,
    actorLabel: null,
    shortDetail: `Contractor quote ${humanize(quote.status)}${quote.rejectionReason ? `: ${quote.rejectionReason}` : ""}`,
    sourceType: "contractor_quote",
  };
}

function mapClientQuoteEvent(quote: ClientQuoteRecord): WorkOrderAuditTimelineEvent {
  return {
    id: `client-quote-${quote.id}`,
    eventLabel: "Client quote update",
    category: "Finance",
    timestamp:
      quote.respondedAt ??
      quote.approvedAt ??
      quote.rejectedAt ??
      quote.sentAt ??
      quote.updatedAt ??
      quote.createdAt,
    actorLabel: null,
    shortDetail: `Client quote ${humanize(quote.status)}${quote.rejectionReason ? `: ${quote.rejectionReason}` : ""}`,
    sourceType: "client_quote",
  };
}

function mapInvoiceEvent(invoice: ClientInvoice): WorkOrderAuditTimelineEvent {
  return {
    id: `invoice-${invoice.id}`,
    eventLabel: "Invoice update",
    category: "Finance",
    timestamp:
      invoice.paidAt ??
      invoice.voidedAt ??
      invoice.overdueAt ??
      invoice.viewedAt ??
      invoice.sentAt ??
      invoice.updatedAt ??
      invoice.createdAt,
    actorLabel: null,
    shortDetail: `${invoice.invoiceNumber} ${humanize(invoice.status)}${invoice.qboSyncStatus ? ` • QBO ${humanize(invoice.qboSyncStatus)}` : ""}`,
    sourceType: "invoice",
  };
}

function mapCommunicationEvent(
  communication: WorkOrderCommunicationMessageItem,
): WorkOrderAuditTimelineEvent {
  const eventLabel =
    communication.subject?.trim() ||
    deriveCommunicationLabel(communication.visibility, communication.direction);
  const actorLabel =
    communication.actor.displayName ?? fallbackActorLabel(communication.actor.actorType);

  return {
    id: `communication-${communication.id}`,
    eventLabel,
    category: "Communication",
    timestamp: communication.sentAt ?? communication.createdAt,
    actorLabel,
    shortDetail: truncate(communication.plainTextBody || communication.body),
    sourceType: "communication",
  };
}

function mapAttachmentEvent(
  attachment: WorkOrderAttachmentSnapshot,
): WorkOrderAuditTimelineEvent {
  return {
    id: `attachment-${attachment.id}`,
    eventLabel: "File attached",
    category: "File",
    timestamp: attachment.createdAt,
    actorLabel: attachment.uploadedByDisplayName,
    shortDetail: attachment.fileName,
    sourceType: "attachment",
  };
}

function categorizeTimelineEntry(entry: WorkOrderTimelineEntry): WorkOrderAuditCategory {
  const haystack = [
    entry.type,
    entry.summary,
    entry.entity.entityType,
    entry.entity.label,
    entry.actor.actorType,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (includesAny(haystack, FILE_KEYWORDS)) {
    return "File";
  }

  if (includesAny(haystack, FINANCE_KEYWORDS)) {
    return "Finance";
  }

  if (includesAny(haystack, COMMUNICATION_KEYWORDS)) {
    return "Communication";
  }

  if (includesAny(haystack, ASSIGNMENT_KEYWORDS)) {
    return "Assignment";
  }

  if (includesAny(haystack, STATUS_KEYWORDS)) {
    return "Workflow";
  }

  if (
    entry.actor.actorType === "system" ||
    includesAny(haystack, SYSTEM_KEYWORDS)
  ) {
    return "System";
  }

  return "Other";
}

function buildTimelineDetail(entry: WorkOrderTimelineEntry): string {
  const parts = [
    entry.type ? humanize(entry.type) : null,
    entry.entity.label
      ? `${humanize(entry.entity.entityType)}: ${entry.entity.label}`
      : null,
  ].filter(Boolean);

  return parts.join(" • ") || "Timeline event recorded";
}

function buildAssignmentAssignedDetail(
  assignment: WorkOrderAuditAssignmentItem,
): string {
  const parts = [
    `${assignment.assigneeDisplayName} assigned by ${assignment.assignedByDisplayName}.`,
  ];

  if (assignment.scheduledDate) {
    parts.push(`Scheduled for ${assignment.scheduledDate}.`);
  }

  const windowLabel = buildTimeWindowLabel(assignment);
  if (windowLabel) {
    parts.push(windowLabel);
  }

  if (assignment.notes?.trim()) {
    parts.push(`Notes: ${truncate(assignment.notes)}`);
  }

  return parts.join(" ");
}

function buildResolutionDetail(
  resolution: "declined" | "completed",
  assignment: WorkOrderAuditAssignmentItem,
): string {
  if (assignment.notes?.trim()) {
    return `${assignment.assigneeDisplayName} ${resolution} the assignment. Notes: ${truncate(assignment.notes)}`;
  }

  return `${assignment.assigneeDisplayName} ${resolution} the assignment.`;
}

function buildTimeWindowLabel(
  assignment: Pick<WorkOrderAuditAssignmentItem, "timeWindowStart" | "timeWindowEnd">,
): string | null {
  if (assignment.timeWindowStart && assignment.timeWindowEnd) {
    return `Window ${assignment.timeWindowStart} to ${assignment.timeWindowEnd}.`;
  }

  if (assignment.timeWindowStart) {
    return `Window starts at ${assignment.timeWindowStart}.`;
  }

  if (assignment.timeWindowEnd) {
    return `Window ends at ${assignment.timeWindowEnd}.`;
  }

  return null;
}

function deriveCommunicationLabel(
  visibility: readonly string[],
  direction: string,
): string {
  if (visibility.includes("client")) {
    return direction === "inbound" ? "Client message received" : "Client message sent";
  }

  if (visibility.includes("contractor")) {
    return direction === "inbound"
      ? "Contractor message received"
      : "Contractor message sent";
  }

  return "Internal communication";
}

function fallbackActorLabel(actorType: string): string {
  if (actorType === "system") {
    return "System";
  }

  if (actorType === "ai") {
    return "AI";
  }

  return "Unknown";
}

function includesAny(haystack: string, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => haystack.includes(keyword));
}

function countByCategory(
  events: readonly WorkOrderAuditTimelineEvent[],
  category: WorkOrderAuditCategory,
) {
  return events.filter((item) => item.category === category).length;
}

function compareAuditEventsRecentFirst(
  left: WorkOrderAuditTimelineEvent,
  right: WorkOrderAuditTimelineEvent,
): number {
  const timeOrder = Date.parse(right.timestamp) - Date.parse(left.timestamp);
  if (timeOrder !== 0) {
    return timeOrder;
  }

  return right.id.localeCompare(left.id);
}

function compareAssignmentsRecentFirst(
  left: WorkOrderAuditAssignmentItem,
  right: WorkOrderAuditAssignmentItem,
): number {
  const leftTimestamp =
    left.completedAt ?? left.declinedAt ?? left.acceptedAt ?? left.assignedAt;
  const rightTimestamp =
    right.completedAt ?? right.declinedAt ?? right.acceptedAt ?? right.assignedAt;

  return Date.parse(rightTimestamp) - Date.parse(leftTimestamp);
}

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

function truncate(value: string, maxLength = 140): string {
  const normalized = value.trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}
