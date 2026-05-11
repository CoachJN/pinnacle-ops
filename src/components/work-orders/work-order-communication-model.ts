import type {
  WorkOrderAssignmentSnapshot,
  WorkOrderNoteSnapshot,
  WorkOrderTimelineEntry,
} from "./work-order-display-model";

export type CommunicationVisibilityAudience =
  | "all"
  | "internal"
  | "client"
  | "contractor"
  | "system";

export type WorkOrderCommunicationSource =
  | "message"
  | "note"
  | "timeline"
  | "assignment_note";

export interface WorkOrderCommunicationAttachmentItem {
  id: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number;
  visibility: string[];
  createdAt: string;
}

export interface WorkOrderCommunicationMessageItem {
  id: string;
  threadId: string;
  messageId: string;
  workOrderId: string | null;
  channel: string;
  direction: string;
  visibility: string[];
  subject: string | null;
  body: string;
  plainTextBody: string;
  createdAt: string;
  sentAt: string | null;
  actor: {
    actorId?: string | null;
    actorType: string;
    actorRole?: string | null;
    displayName: string | null;
  };
  attachments: WorkOrderCommunicationAttachmentItem[];
  relatedEventIds: string[];
  linkedEntityIds: string[];
}

export interface WorkOrderCommunicationAssignmentNoteSnapshot
  extends Pick<WorkOrderAssignmentSnapshot, "id"> {
  assigneeDisplayName: string;
  assignedAt: string;
  notes: string | null;
  scheduledDate?: string | null;
}

export interface DerivedWorkOrderCommunicationItem {
  id: string;
  source: WorkOrderCommunicationSource;
  sourceLabel: string;
  audience: Exclude<CommunicationVisibilityAudience, "all">;
  occurredAt: string;
  title: string;
  detail: string;
  body: string | null;
  actorLabel: string;
  actorDetail: string | null;
  badgeLabel: string;
  attachmentCount: number;
}

export interface DerivedWorkOrderCommunicationSummary {
  mostRecentCommunicationAt: string | null;
  lastInternalNoteAt: string | null;
  lastClientVisibleCommunicationAt: string | null;
  lastContractorVisibleCommunicationAt: string | null;
  totalCommunicationCount: number;
  status: string;
  guidance: string[];
  hasGapWarning: boolean;
  gapWarning: string | null;
}

export interface DerivedWorkOrderFollowUpSnapshot {
  lastActivityAt: string | null;
  lastActivityDays: number | null;
  status: string;
  guidance: string[];
}

interface BuildWorkOrderCommunicationTimelineInput {
  assignments: WorkOrderCommunicationAssignmentNoteSnapshot[];
  communications: WorkOrderCommunicationMessageItem[];
  notes: WorkOrderNoteSnapshot[];
  timeline: WorkOrderTimelineEntry[];
}

interface CommunicationSummaryInput extends BuildWorkOrderCommunicationTimelineInput {
  assignedContractorLabel: string;
  now?: string;
  staleAfterDays?: number;
}

interface FollowUpInput {
  assignedContractorLabel: string;
  items: DerivedWorkOrderCommunicationItem[];
  now?: string;
  staleAfterDays?: number;
}

const INTERNAL_NOTE_CHANNEL = "internal_note";
const SYSTEM_DIRECTIONS = new Set(["system"]);
const SYSTEM_VISIBILITY = "system";
const CLIENT_VISIBILITY = "client";
const CONTRACTOR_VISIBILITY = "contractor";
const INTERNAL_VISIBILITY = "internal";
const DEFAULT_STALE_AFTER_DAYS = 3;
const COMMUNICATION_TIMELINE_KEYWORDS = [
  "communication",
  "message",
  "note",
  "email",
  "sms",
  "call",
  "voicemail",
  "portal_message",
  "portal message",
];
const FINANCE_COMMUNICATION_KEYWORDS = [
  "quote sent",
  "quote requested",
  "approval requested",
  "client approval",
  "invoice sent",
  "invoice viewed",
  "invoice reminder",
  "payment reminder",
];

export function buildWorkOrderCommunicationTimeline(
  input: BuildWorkOrderCommunicationTimelineInput,
): DerivedWorkOrderCommunicationItem[] {
  const communicationIds = new Set(input.communications.map((item) => item.id));
  const items = [
    ...input.communications.map(normalizeCommunicationMessage),
    ...input.notes
      .filter((note) => !communicationIds.has(note.id))
      .map(normalizeLegacyNote),
    ...input.timeline
      .filter(isCommunicationTimelineEntry)
      .map(normalizeTimelineEntry),
    ...input.assignments
      .filter((assignment) => Boolean(assignment.notes?.trim()))
      .map(normalizeAssignmentNote),
  ];

  return items.sort(compareCommunicationItems);
}

export function deriveWorkOrderCommunicationSummary(
  input: CommunicationSummaryInput,
): DerivedWorkOrderCommunicationSummary {
  const items = buildWorkOrderCommunicationTimeline(input);
  const staleAfterDays = input.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const mostRecentCommunicationAt = items[0]?.occurredAt ?? null;
  const lastInternalNoteAt =
    items.find((item) => item.source === "note" && item.audience === "internal")?.occurredAt ??
    items.find(
      (item) => item.source === "message" && item.audience === "internal",
    )?.occurredAt ??
    null;
  const lastClientVisibleCommunicationAt =
    items.find((item) => item.audience === "client")?.occurredAt ?? null;
  const lastContractorVisibleCommunicationAt =
    items.find((item) => item.audience === "contractor")?.occurredAt ?? null;
  const daysSinceMostRecent = mostRecentCommunicationAt
    ? diffInWholeDays(mostRecentCommunicationAt, input.now)
    : null;
  const hasGapWarning =
    mostRecentCommunicationAt === null ||
    (daysSinceMostRecent !== null && daysSinceMostRecent >= staleAfterDays);

  if (items.length === 0) {
    return {
      mostRecentCommunicationAt,
      lastInternalNoteAt,
      lastClientVisibleCommunicationAt,
      lastContractorVisibleCommunicationAt,
      totalCommunicationCount: 0,
      status: "No communications recorded yet",
      guidance: ["No communications recorded yet"],
      hasGapWarning: true,
      gapWarning: "No recent communication exists for this work order.",
    };
  }

  const guidance = new Set<string>();

  if (hasGapWarning) {
    guidance.add("Communication gap warning");
  } else {
    guidance.add("Communication activity is current");
  }

  if (lastClientVisibleCommunicationAt === null) {
    guidance.add("Client has not been updated");
  }

  if (
    input.assignedContractorLabel !== "Unassigned" &&
    lastContractorVisibleCommunicationAt === null
  ) {
    guidance.add("Contractor follow-up may be required");
  }

  if (
    lastInternalNoteAt !== null &&
    lastClientVisibleCommunicationAt === null &&
    lastContractorVisibleCommunicationAt === null
  ) {
    guidance.add("Recent internal activity only");
  }

  return {
    mostRecentCommunicationAt,
    lastInternalNoteAt,
    lastClientVisibleCommunicationAt,
    lastContractorVisibleCommunicationAt,
    totalCommunicationCount: items.length,
    status: deriveCommunicationPosture({
      assignedContractorLabel: input.assignedContractorLabel,
      hasGapWarning,
      lastClientVisibleCommunicationAt,
      lastContractorVisibleCommunicationAt,
      lastInternalNoteAt,
    }),
    guidance: [...guidance],
    hasGapWarning,
    gapWarning: hasGapWarning
      ? mostRecentCommunicationAt === null
        ? "No recent communication exists for this work order."
        : `No communication has been recorded in ${daysSinceMostRecent} day${daysSinceMostRecent === 1 ? "" : "s"}.`
      : null,
  };
}

export function deriveWorkOrderFollowUpSnapshot(
  input: FollowUpInput,
): DerivedWorkOrderFollowUpSnapshot {
  const staleAfterDays = input.staleAfterDays ?? DEFAULT_STALE_AFTER_DAYS;
  const lastActivityAt = input.items[0]?.occurredAt ?? null;

  if (!lastActivityAt) {
    return {
      lastActivityAt: null,
      lastActivityDays: null,
      status: "No follow-up recorded",
      guidance: ["No follow-up recorded"],
    };
  }

  const lastActivityDays = diffInWholeDays(lastActivityAt, input.now);
  const guidance = [
    `Last communication was ${lastActivityDays} day${lastActivityDays === 1 ? "" : "s"} ago`,
  ];
  const hasClientActivity = input.items.some((item) => item.audience === "client");
  const hasContractorActivity = input.items.some((item) => item.audience === "contractor");

  if (!hasClientActivity) {
    guidance.push("Client update may be needed");
  }

  if (input.assignedContractorLabel !== "Unassigned" && !hasContractorActivity) {
    guidance.push("Contractor follow-up may be needed");
  }

  if (lastActivityDays >= staleAfterDays) {
    guidance.unshift("Follow-up stale");
  } else {
    guidance.unshift("Communication is current");
  }

  return {
    lastActivityAt,
    lastActivityDays,
    status:
      lastActivityDays >= staleAfterDays ? "Follow-up stale" : "Communication is current",
    guidance,
  };
}

export function filterWorkOrderCommunicationItems(
  items: DerivedWorkOrderCommunicationItem[],
  filter: CommunicationVisibilityAudience,
): DerivedWorkOrderCommunicationItem[] {
  if (filter === "all") {
    return items;
  }

  return items.filter((item) => item.audience === filter);
}

function normalizeCommunicationMessage(
  message: WorkOrderCommunicationMessageItem,
): DerivedWorkOrderCommunicationItem {
  const audience = deriveAudience(message.visibility, message.direction);
  const actorLabel = message.actor.displayName ?? fallbackActorLabel(message.actor.actorType);
  const title =
    message.subject?.trim() ||
    (message.channel === INTERNAL_NOTE_CHANNEL
      ? "Internal note"
      : `${toTitleCase(audience)} communication`);

  return {
    id: `message-${message.id}`,
    source: message.channel === INTERNAL_NOTE_CHANNEL ? "note" : "message",
    sourceLabel:
      message.channel === INTERNAL_NOTE_CHANNEL ? "Internal note record" : "Communication record",
    audience,
    occurredAt: message.sentAt ?? message.createdAt,
    title,
    detail:
      message.channel === INTERNAL_NOTE_CHANNEL
        ? "Internal note recorded"
        : `${toTitleCase(audience)} ${message.direction === "inbound" ? "message received" : "message sent"}`,
    body: message.plainTextBody || message.body,
    actorLabel,
    actorDetail: describeMessageActor(message),
    badgeLabel: audienceBadgeLabel(audience),
    attachmentCount: message.attachments.length,
  };
}

function normalizeLegacyNote(note: WorkOrderNoteSnapshot): DerivedWorkOrderCommunicationItem {
  return {
    id: `note-${note.id}`,
    source: "note",
    sourceLabel: "Legacy note",
    audience: "internal",
    occurredAt: note.updatedAt,
    title: "Internal note",
    detail: "Legacy internal note record",
    body: note.body,
    actorLabel: note.authorDisplayName,
    actorDetail: "Internal note",
    badgeLabel: audienceBadgeLabel("internal"),
    attachmentCount: 0,
  };
}

function normalizeTimelineEntry(
  entry: WorkOrderTimelineEntry,
): DerivedWorkOrderCommunicationItem {
  const audience = deriveTimelineAudience(entry);

  return {
    id: `timeline-${entry.id}`,
    source: "timeline",
    sourceLabel: "Timeline event",
    audience,
    occurredAt: entry.occurredAt,
    title: entry.summary,
    detail: entry.entity.label
      ? `${entry.entity.entityType.replaceAll("_", " ")}: ${entry.entity.label}`
      : entry.type.replaceAll("_", " "),
    body: null,
    actorLabel: entry.actor.displayName ?? fallbackActorLabel(entry.actor.actorType),
    actorDetail:
      audience === "system"
        ? "System communication event"
        : `${toTitleCase(audience)} communication event`,
    badgeLabel: audienceBadgeLabel(audience),
    attachmentCount: 0,
  };
}

function normalizeAssignmentNote(
  assignment: WorkOrderCommunicationAssignmentNoteSnapshot,
): DerivedWorkOrderCommunicationItem {
  return {
    id: `assignment-${assignment.id}`,
    source: "assignment_note",
    sourceLabel: "Assignment note",
    audience: "internal",
    occurredAt: assignment.assignedAt,
    title: "Assignment note",
    detail: `Dispatch context for ${assignment.assigneeDisplayName}`,
    body: assignment.notes?.trim() ?? null,
    actorLabel: assignment.assigneeDisplayName,
    actorDetail: "Assignment and dispatch note",
    badgeLabel: audienceBadgeLabel("internal"),
    attachmentCount: 0,
  };
}

function deriveAudience(
  visibility: readonly string[],
  direction: string,
): Exclude<CommunicationVisibilityAudience, "all"> {
  if (
    SYSTEM_DIRECTIONS.has(direction) ||
    visibility.includes(SYSTEM_VISIBILITY)
  ) {
    return "system";
  }

  if (visibility.includes(CLIENT_VISIBILITY)) {
    return "client";
  }

  if (visibility.includes(CONTRACTOR_VISIBILITY)) {
    return "contractor";
  }

  if (visibility.includes(INTERNAL_VISIBILITY)) {
    return "internal";
  }

  return "system";
}

export function isCommunicationTimelineEntry(entry: WorkOrderTimelineEntry): boolean {
  const searchText = [
    entry.type,
    entry.summary,
    entry.entity.entityType,
    entry.entity.label,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  return (
    COMMUNICATION_TIMELINE_KEYWORDS.some((keyword) => searchText.includes(keyword)) ||
    FINANCE_COMMUNICATION_KEYWORDS.some((keyword) => searchText.includes(keyword))
  );
}

function deriveTimelineAudience(
  entry: WorkOrderTimelineEntry,
): Exclude<CommunicationVisibilityAudience, "all"> {
  const searchText = [
    entry.type,
    entry.summary,
    entry.entity.entityType,
    entry.entity.label,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();

  if (searchText.includes("client")) {
    return "client";
  }

  if (searchText.includes("contractor")) {
    return "contractor";
  }

  if (searchText.includes("internal") || searchText.includes("note")) {
    return "internal";
  }

  return "system";
}

function audienceBadgeLabel(
  audience: Exclude<CommunicationVisibilityAudience, "all">,
): string {
  switch (audience) {
    case "internal":
      return "Internal";
    case "client":
      return "Client";
    case "contractor":
      return "Contractor";
    case "system":
      return "System";
  }
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

function describeMessageActor(message: WorkOrderCommunicationMessageItem): string | null {
  if (message.direction === "inbound") {
    return "Inbound communication";
  }

  if (message.direction === "outbound") {
    return "Outbound communication";
  }

  if (message.direction === "internal") {
    return "Internal note";
  }

  return "System communication";
}

function compareCommunicationItems(
  left: DerivedWorkOrderCommunicationItem,
  right: DerivedWorkOrderCommunicationItem,
): number {
  const timeOrder = Date.parse(right.occurredAt) - Date.parse(left.occurredAt);
  if (timeOrder !== 0) {
    return timeOrder;
  }

  return right.id.localeCompare(left.id);
}

function diffInWholeDays(value: string, now = new Date().toISOString()): number {
  const diffMs = Date.parse(now) - Date.parse(value);
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function deriveCommunicationPosture(input: {
  assignedContractorLabel: string;
  hasGapWarning: boolean;
  lastClientVisibleCommunicationAt: string | null;
  lastContractorVisibleCommunicationAt: string | null;
  lastInternalNoteAt: string | null;
}): string {
  if (
    input.lastInternalNoteAt !== null &&
    input.lastClientVisibleCommunicationAt === null &&
    input.lastContractorVisibleCommunicationAt === null
  ) {
    return "Recent internal activity only";
  }

  if (input.lastClientVisibleCommunicationAt === null) {
    return "Client has not been updated";
  }

  if (
    input.assignedContractorLabel !== "Unassigned" &&
    input.lastContractorVisibleCommunicationAt === null
  ) {
    return "Contractor follow-up may be required";
  }

  if (!input.hasGapWarning) {
    return "Communication activity is current";
  }

  return "Communication review recommended";
}

function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
