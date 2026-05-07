import type { CommunicationVisibility } from "@/modules/communications";
import type { EntityId, IsoDateTimeString } from "@/types/entity";

export const PROVIDER_KEYS = {
  MicrosoftGraph: "microsoft_graph",
} as const;

export type ProviderKey =
  (typeof PROVIDER_KEYS)[keyof typeof PROVIDER_KEYS];

export const PROVIDER_CONNECTION_STATUSES = {
  Active: "active",
  Disabled: "disabled",
  Error: "error",
  Expired: "expired",
  ReconnectRequired: "reconnect_required",
} as const;

export type ProviderConnectionStatus =
  (typeof PROVIDER_CONNECTION_STATUSES)[keyof typeof PROVIDER_CONNECTION_STATUSES];

export const PROVIDER_SYNC_CHECKPOINT_STATUSES = {
  Idle: "idle",
  Running: "running",
  Error: "error",
} as const;

export type ProviderSyncCheckpointStatus =
  (typeof PROVIDER_SYNC_CHECKPOINT_STATUSES)[keyof typeof PROVIDER_SYNC_CHECKPOINT_STATUSES];

export const PROVIDER_CONNECTION_HEALTH_STATUSES = {
  Healthy: "healthy",
  Degraded: "degraded",
  Unhealthy: "unhealthy",
  Unknown: "unknown",
} as const;

export type ProviderConnectionHealthStatus =
  (typeof PROVIDER_CONNECTION_HEALTH_STATUSES)[keyof typeof PROVIDER_CONNECTION_HEALTH_STATUSES];

export const PROVIDER_SYNC_RUN_STATUSES = {
  Running: "running",
  Completed: "completed",
  Failed: "failed",
  Released: "released",
} as const;

export type ProviderSyncRunStatus =
  (typeof PROVIDER_SYNC_RUN_STATUSES)[keyof typeof PROVIDER_SYNC_RUN_STATUSES];

export const PROVIDER_ATTACHMENT_HYDRATION_STATUSES = {
  Pending: "pending",
  Hydrated: "hydrated",
  Failed: "failed",
  NotRequested: "not_requested",
} as const;

export type ProviderAttachmentHydrationStatus =
  (typeof PROVIDER_ATTACHMENT_HYDRATION_STATUSES)[keyof typeof PROVIDER_ATTACHMENT_HYDRATION_STATUSES];

export interface ProviderMailboxScope {
  mailboxAddress: string | null;
  folderId: string | null;
  folderName: string | null;
  folderPath: string | null;
  metadata: Record<string, unknown>;
}

export interface ProviderSyncErrorState {
  code: string | null;
  message: string | null;
  occurredAt: IsoDateTimeString | null;
  details: Record<string, unknown>;
}

export const PROVIDER_MESSAGE_RECEIPT_STATUSES = {
  Ingested: "ingested",
  Duplicate: "duplicate",
  Rejected: "rejected",
  Failed: "failed",
} as const;

export type ProviderMessageReceiptStatus =
  (typeof PROVIDER_MESSAGE_RECEIPT_STATUSES)[keyof typeof PROVIDER_MESSAGE_RECEIPT_STATUSES];

export interface ProviderConnection {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  providerKey: ProviderKey;
  providerTenantId: string | null;
  providerAccountId: string | null;
  mailboxAddress: string | null;
  displayName: string | null;
  scopes: string[];
  scopeMetadata: Record<string, unknown>;
  status: ProviderConnectionStatus;
  healthStatus: ProviderConnectionHealthStatus;
  ownerUserId: EntityId | null;
  connectedAt: IsoDateTimeString | null;
  disabledAt: IsoDateTimeString | null;
  expiresAt: IsoDateTimeString | null;
  lastHealthyAt: IsoDateTimeString | null;
  lastError: ProviderSyncErrorState | null;
  lastSyncedAt: IsoDateTimeString | null;
  metadata: Record<string, unknown>;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface ProviderSyncCheckpoint {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  providerKey: ProviderKey;
  providerConnectionId: EntityId | null;
  checkpointType: "email_delta";
  mailboxScope: ProviderMailboxScope;
  cursor: string | null;
  lastProcessedReceivedAt: IsoDateTimeString | null;
  lastAttemptedAt: IsoDateTimeString | null;
  lastSuccessfulSyncAt: IsoDateTimeString | null;
  status: ProviderSyncCheckpointStatus;
  failureCount: number;
  lastError: ProviderSyncErrorState | null;
  nextRetryAt: IsoDateTimeString | null;
  metadata: Record<string, unknown>;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface ProviderSyncRun {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  connectionId: EntityId;
  providerKey: ProviderKey;
  mailboxScope: ProviderMailboxScope;
  startedAt: IsoDateTimeString;
  completedAt: IsoDateTimeString | null;
  status: ProviderSyncRunStatus;
  messagesSeen: number;
  messagesIngested: number;
  duplicatesSkipped: number;
  failures: number;
  checkpointBefore: Pick<
    ProviderSyncCheckpoint,
    | "id"
    | "cursor"
    | "lastProcessedReceivedAt"
    | "lastAttemptedAt"
    | "lastSuccessfulSyncAt"
    | "failureCount"
    | "nextRetryAt"
  > | null;
  checkpointAfter: Pick<
    ProviderSyncCheckpoint,
    | "id"
    | "cursor"
    | "lastProcessedReceivedAt"
    | "lastAttemptedAt"
    | "lastSuccessfulSyncAt"
    | "failureCount"
    | "nextRetryAt"
  > | null;
  errorSummary: string | null;
  claim: {
    claimedBy: string | null;
    claimedAt: IsoDateTimeString | null;
    releasedAt: IsoDateTimeString | null;
  };
  metadata: Record<string, unknown>;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface ProviderMessageReceipt {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  providerKey: ProviderKey;
  providerConnectionId: EntityId | null;
  providerMessageId: string | null;
  internetMessageId: string | null;
  providerThreadId: string | null;
  canonicalThreadId: EntityId | null;
  canonicalMessageId: EntityId | null;
  intakeEventId: EntityId | null;
  attachmentIds: EntityId[];
  fingerprint: string;
  status: ProviderMessageReceiptStatus;
  visibility: CommunicationVisibility[];
  receivedAt: IsoDateTimeString;
  processedAt: IsoDateTimeString;
  failureReason: string | null;
  reviewedAt: IsoDateTimeString | null;
  reviewedByUserId: EntityId | null;
  supersededByReceiptId: EntityId | null;
  metadata: Record<string, unknown>;
  createdAt: IsoDateTimeString;
}

export interface ProviderThreadMapping {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  providerKey: ProviderKey;
  providerConnectionId: EntityId | null;
  providerThreadId: string;
  canonicalThreadId: EntityId;
  latestProviderMessageId: string | null;
  latestInternetMessageId: string | null;
  latestCanonicalMessageId: EntityId | null;
  messageCount: number;
  threadFingerprint: string;
  metadata: Record<string, unknown>;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface NormalizedEmailAddress {
  displayName: string | null;
  email: string | null;
  externalParticipantId: string | null;
  metadata: Record<string, unknown>;
}

export interface ProviderAttachmentReference {
  id: string;
  providerAttachmentId: string | null;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  storagePath: string | null;
  contentId: string | null;
  isInline: boolean;
  uploadedAt: IsoDateTimeString | null;
  checksum: string | null;
  hydrationStatus: ProviderAttachmentHydrationStatus;
  hydratedAt: IsoDateTimeString | null;
  hydrationError: string | null;
  metadata: Record<string, unknown>;
}

export interface NormalizedEmailMessage {
  subject: string | null;
  body: string;
  plainTextBody: string;
  normalizedText: string;
  preview: string | null;
  sender: NormalizedEmailAddress | null;
  recipients: NormalizedEmailAddress[];
  cc: NormalizedEmailAddress[];
  bcc: NormalizedEmailAddress[];
  messageId: string | null;
  internetMessageId: string | null;
  conversationId: string | null;
  inReplyTo: string | null;
  replyReferences: string[];
  receivedAt: IsoDateTimeString;
  sentAt: IsoDateTimeString | null;
  attachments: ProviderAttachmentReference[];
  metadata: Record<string, unknown>;
}

export interface NormalizedEmailThread {
  providerThreadId: string | null;
  providerConversationId: string | null;
  parentProviderMessageId: string | null;
  parentInternetMessageId: string | null;
  conversationIndex: string | null;
  conversationPath: string[];
  threadFingerprint: string;
  metadata: Record<string, unknown>;
}

export interface ProviderSyncRequest {
  organizationId: EntityId;
  tenantId: EntityId;
  connectionId: EntityId;
  providerKey: ProviderKey;
  mailboxScope: ProviderMailboxScope;
  requestedAt: IsoDateTimeString;
  requestedByUserId: EntityId | null;
  forceFullResync: boolean;
  replayFailedReceipts: boolean;
  metadata: Record<string, unknown>;
}

export interface PollMailboxRequest extends ProviderSyncRequest {
  checkpointId: EntityId | null;
  cursor: string | null;
}

export interface ProviderWebhookEventEnvelope {
  providerKey: ProviderKey;
  connectionId: EntityId | null;
  mailboxScope: ProviderMailboxScope;
  providerEventId: string | null;
  providerEventType: string;
  occurredAt: IsoDateTimeString;
  payload: Record<string, unknown>;
}

export interface ProviderSyncRunClaim {
  runId: EntityId;
  claimedBy: string;
  claimedAt: IsoDateTimeString;
  leaseExpiresAt: IsoDateTimeString | null;
}

export interface ProviderReplayJobRequest {
  organizationId: EntityId;
  tenantId: EntityId;
  connectionId: EntityId | null;
  providerKey: ProviderKey;
  receiptId: EntityId | null;
  providerMessageId: string | null;
  providerThreadId: string | null;
  requestedAt: IsoDateTimeString;
  requestedByUserId: EntityId | null;
  reason: string | null;
  metadata: Record<string, unknown>;
}
