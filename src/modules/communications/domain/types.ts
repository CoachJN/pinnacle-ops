import type { AccessActor } from "@/types/auth";
import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { ProviderAttachmentHydrationStatus } from "@/modules/providers";
import type { UserRole } from "@/types/permissions";

export const COMMUNICATION_CHANNELS = {
  InternalNote: "internal_note",
  PortalMessage: "portal_message",
  SystemMessage: "system_message",
  Email: "email",
  Sms: "sms",
  Slack: "slack",
  Teams: "teams",
  Voicemail: "voicemail",
  Call: "call",
} as const;

export type CommunicationChannel =
  (typeof COMMUNICATION_CHANNELS)[keyof typeof COMMUNICATION_CHANNELS];

export const COMMUNICATION_DIRECTIONS = {
  Inbound: "inbound",
  Outbound: "outbound",
  Internal: "internal",
  System: "system",
} as const;

export type CommunicationDirection =
  (typeof COMMUNICATION_DIRECTIONS)[keyof typeof COMMUNICATION_DIRECTIONS];

export const COMMUNICATION_VISIBILITIES = {
  Internal: "internal",
  Client: "client",
  Contractor: "contractor",
  Finance: "finance",
  System: "system",
} as const;

export type CommunicationVisibility =
  (typeof COMMUNICATION_VISIBILITIES)[keyof typeof COMMUNICATION_VISIBILITIES];

export type CommunicationActorType = "user" | "system" | "ai";

export interface CommunicationActorReference {
  actorId: EntityId | null;
  actorType: CommunicationActorType;
  actorRole: UserRole | "system" | "ai" | null;
  displayName: string | null;
}

export interface CommunicationThread {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  workOrderId: EntityId | null;
  channel: CommunicationChannel;
  subject: string | null;
  visibility: CommunicationVisibility[];
  participantIds: EntityId[];
  relatedEventIds: EntityId[];
  linkedEntityIds: EntityId[];
  lastMessageId: EntityId | null;
  lastMessageAt: IsoDateTimeString | null;
  externalProvider: string | null;
  externalThreadId: string | null;
  metadata: Record<string, unknown>;
  createdAt: IsoDateTimeString;
  createdByActor: CommunicationActorReference;
  updatedAt: IsoDateTimeString;
}

export interface CommunicationMessage {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  threadId: EntityId;
  workOrderId: EntityId | null;
  referenceMessageId: EntityId | null;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  visibility: CommunicationVisibility[];
  subject: string | null;
  body: string;
  plainTextBody: string;
  normalizedContent: string;
  metadata: Record<string, unknown>;
  senderActorId: EntityId | null;
  senderActorType: CommunicationActorType;
  senderActorRole: UserRole | "system" | "ai" | null;
  participantIds: EntityId[];
  clientContactId: EntityId | null;
  contractorOrganizationId: EntityId | null;
  linkedEntityIds: EntityId[];
  relatedEventIds: EntityId[];
  sentAt: IsoDateTimeString | null;
  deliveredAt: IsoDateTimeString | null;
  readAt: IsoDateTimeString | null;
  externalProvider: string | null;
  externalThreadId: string | null;
  externalMessageId: string | null;
  createdAt: IsoDateTimeString;
  createdByActor: CommunicationActorReference;
}

export interface CommunicationParticipant {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  threadId: EntityId;
  workOrderId: EntityId | null;
  actorType: CommunicationActorType;
  userId: EntityId | null;
  userRole: UserRole | "system" | "ai" | null;
  contactId: EntityId | null;
  clientOrganizationId: EntityId | null;
  contractorOrganizationId: EntityId | null;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  visibility: CommunicationVisibility[];
  joinedAt: IsoDateTimeString;
  metadata: Record<string, unknown>;
}

export type CommunicationLinkEntityType =
  | "work_order"
  | "quote"
  | "invoice"
  | "assignment"
  | "event"
  | "intake_event"
  | "intake_artifact"
  | "communication_thread"
  | "communication_message";

export interface CommunicationLink {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  threadId: EntityId | null;
  messageId: EntityId | null;
  workOrderId: EntityId | null;
  entityType: CommunicationLinkEntityType;
  entityId: EntityId;
  relationshipType: "primary" | "related" | "attachment" | "suggested_match";
  createdAt: IsoDateTimeString;
  createdByActor: CommunicationActorReference;
  metadata: Record<string, unknown>;
}

export interface CommunicationAttachment {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  threadId: EntityId;
  messageId: EntityId;
  workOrderId: EntityId | null;
  fileName: string;
  contentType: string | null;
  sizeBytes: number;
  storagePath: string;
  hydrationStatus: ProviderAttachmentHydrationStatus;
  hydratedAt: IsoDateTimeString | null;
  hydrationError: string | null;
  contentHash: string | null;
  visibility: CommunicationVisibility[];
  uploadedByActor: CommunicationActorReference;
  externalProvider: string | null;
  externalAttachmentId: string | null;
  metadata: Record<string, unknown>;
  createdAt: IsoDateTimeString;
}

export interface CommunicationTimelineAttachment {
  id: EntityId;
  fileName: string;
  contentType: string | null;
  sizeBytes: number;
  visibility: CommunicationVisibility[];
  hydrationStatus: ProviderAttachmentHydrationStatus;
  hydratedAt: IsoDateTimeString | null;
  createdAt: IsoDateTimeString;
}

export interface CommunicationMatchSuggestion {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  threadId: EntityId | null;
  messageId: EntityId;
  workOrderId: EntityId | null;
  suggestedEntityType: CommunicationLinkEntityType;
  suggestedEntityId: EntityId;
  confidenceScore: number;
  status: "pending_review" | "approved" | "rejected";
  suggestedAt: IsoDateTimeString;
  reviewedAt: IsoDateTimeString | null;
  reviewedByActor: CommunicationActorReference | null;
  rationale: string | null;
  metadata: Record<string, unknown>;
}

export interface CommunicationTimelineEntry {
  id: EntityId;
  threadId: EntityId;
  messageId: EntityId;
  workOrderId: EntityId | null;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  visibility: CommunicationVisibility[];
  subject: string | null;
  body: string;
  plainTextBody: string;
  createdAt: IsoDateTimeString;
  sentAt: IsoDateTimeString | null;
  actor: CommunicationActorReference;
  attachments: CommunicationTimelineAttachment[];
  relatedEventIds: EntityId[];
  linkedEntityIds: EntityId[];
}

export function canActorReadCommunicationVisibility(
  actor: AccessActor,
  visibility: readonly CommunicationVisibility[],
): boolean {
  if (actor.actorType === "internal") {
    const baseVisible = visibility.some((item) =>
      item === COMMUNICATION_VISIBILITIES.Internal ||
      item === COMMUNICATION_VISIBILITIES.Client ||
      item === COMMUNICATION_VISIBILITIES.Contractor ||
      item === COMMUNICATION_VISIBILITIES.System,
    );
    const canReadFinance =
      actor.role === "owner" || actor.role === "finance_admin";

    return (
      baseVisible ||
      (canReadFinance && visibility.includes(COMMUNICATION_VISIBILITIES.Finance))
    );
  }

  if (actor.actorType === "client") {
    return visibility.includes(COMMUNICATION_VISIBILITIES.Client);
  }

  return visibility.includes(COMMUNICATION_VISIBILITIES.Contractor);
}
