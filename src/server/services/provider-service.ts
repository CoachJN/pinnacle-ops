import "server-only";

import type { CommunicationAttachment } from "@/modules/communications";
import type {
  PollMailboxRequest,
  ProviderConnection,
  ProviderConnectionHealthStatus,
  ProviderMailboxScope,
  ProviderMessageReceipt,
  ProviderReplayJobRequest,
  ProviderSyncCheckpoint,
  ProviderSyncRun,
  ProviderSyncRunClaim,
  ProviderThreadMapping,
  ProviderWebhookEventEnvelope,
} from "@/modules/providers";
import type { FirestoreRepositories } from "@/server/repositories";
import type { EntityId } from "@/types/entity";
import { notFoundError, validationError } from "./errors";
import type { DomainEventService } from "./domain-event-service";
import type { IntakeDomainServices, ProviderIngestionResult } from "./intake-service";
import { nowIso, serviceFail, serviceOk, type ServiceAuditContext, type ServiceResult } from "./types";

export interface CreateProviderConnectionInput extends ServiceAuditContext {
  providerKey: ProviderConnection["providerKey"];
  providerTenantId?: string | null;
  providerAccountId?: string | null;
  mailboxAddress?: string | null;
  displayName?: string | null;
  scopes?: string[];
  scopeMetadata?: Record<string, unknown>;
  ownerUserId?: EntityId | null;
  expiresAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface UpdateProviderConnectionStatusInput extends ServiceAuditContext {
  connectionId: EntityId;
  status: ProviderConnection["status"];
  healthStatus?: ProviderConnectionHealthStatus;
  errorCode?: string | null;
  errorMessage?: string | null;
  errorDetails?: Record<string, unknown>;
}

export interface UpsertProviderCheckpointInput extends ServiceAuditContext {
  connectionId: EntityId | null;
  providerKey: ProviderSyncCheckpoint["providerKey"];
  checkpointType: ProviderSyncCheckpoint["checkpointType"];
  mailboxScope: ProviderMailboxScope;
  cursor?: string | null;
  lastProcessedReceivedAt?: string | null;
  metadata?: Record<string, unknown>;
}

export interface RecordProviderCheckpointAttemptInput extends ServiceAuditContext {
  checkpointId: EntityId;
  nextRetryAt?: string | null;
}

export interface RecordProviderCheckpointSuccessInput extends ServiceAuditContext {
  checkpointId: EntityId;
  cursor?: string | null;
  lastProcessedReceivedAt?: string | null;
}

export interface RecordProviderCheckpointFailureInput extends ServiceAuditContext {
  checkpointId: EntityId;
  errorCode?: string | null;
  errorMessage: string;
  errorDetails?: Record<string, unknown>;
  nextRetryAt?: string | null;
}

export interface StartProviderSyncRunInput extends ServiceAuditContext {
  connectionId: EntityId;
  checkpointId?: EntityId | null;
  mailboxScope: ProviderMailboxScope;
  metadata?: Record<string, unknown>;
}

export interface CompleteProviderSyncRunInput extends ServiceAuditContext {
  syncRunId: EntityId;
  claimedBy: string;
  claimToken: string;
  checkpointId?: EntityId | null;
  messagesSeen: number;
  messagesIngested: number;
  duplicatesSkipped: number;
  failures: number;
  checkpointAfter?: ProviderSyncRun["checkpointAfter"];
}

export interface FailProviderSyncRunInput extends ServiceAuditContext {
  syncRunId: EntityId;
  claimedBy: string;
  claimToken: string;
  checkpointId?: EntityId | null;
  reason: string;
  failures: number;
  checkpointAfter?: ProviderSyncRun["checkpointAfter"];
}

export interface HydrateProviderAttachmentInput extends ServiceAuditContext {
  attachmentId: EntityId;
  expectedMimeTypes?: string[];
  maximumSizeBytes?: number | null;
  storagePath?: string | null;
}

export interface ProviderAttachmentHydrationSource {
  getAttachmentContent(input: {
    attachment: CommunicationAttachment;
  }): Promise<{
    content: Uint8Array;
    mimeType: string | null;
    sizeBytes: number;
    storagePath?: string | null;
    contentHash?: string | null;
  }>;
}

export interface ProviderConnectionQueryService {
  listConnections(organizationId: EntityId): Promise<ServiceResult<ProviderConnection[]>>;
  listSyncCheckpoints(providerConnectionId: EntityId): Promise<ServiceResult<ProviderSyncCheckpoint[]>>;
  listSyncRuns(connectionId: EntityId): Promise<ServiceResult<ProviderSyncRun[]>>;
  listMessageReceipts(providerConnectionId: EntityId): Promise<ServiceResult<ProviderMessageReceipt[]>>;
}

export interface ProviderConnectionManagementService {
  create(input: CreateProviderConnectionInput): Promise<ServiceResult<ProviderConnection>>;
  updateStatus(input: UpdateProviderConnectionStatusInput): Promise<ServiceResult<ProviderConnection>>;
}

export interface ProviderCheckpointService {
  upsert(input: UpsertProviderCheckpointInput): Promise<ServiceResult<ProviderSyncCheckpoint>>;
  recordAttempt(input: RecordProviderCheckpointAttemptInput): Promise<ServiceResult<ProviderSyncCheckpoint>>;
  recordSuccess(input: RecordProviderCheckpointSuccessInput): Promise<ServiceResult<ProviderSyncCheckpoint>>;
  recordFailure(input: RecordProviderCheckpointFailureInput): Promise<ServiceResult<ProviderSyncCheckpoint>>;
}

export interface ProviderSyncRunService {
  start(input: StartProviderSyncRunInput): Promise<ServiceResult<ProviderSyncRun>>;
  complete(input: CompleteProviderSyncRunInput): Promise<ServiceResult<ProviderSyncRun>>;
  fail(input: FailProviderSyncRunInput): Promise<ServiceResult<ProviderSyncRun>>;
  claim(input: { syncRunId: EntityId; claim: ProviderSyncRunClaim }): Promise<ServiceResult<ProviderSyncRun>>;
  release(input: ServiceAuditContext & {
    syncRunId: EntityId;
    claimedBy: string;
    claimToken: string;
  }): Promise<ServiceResult<ProviderSyncRun>>;
}

export interface ProviderReplayService {
  replayMessageByProviderMessageId(input: ServiceAuditContext & {
    providerMessageId: string;
  }): Promise<ServiceResult<ProviderIngestionResult>>;
  replayByReceiptId(input: ServiceAuditContext & {
    receiptId: EntityId;
  }): Promise<ServiceResult<ProviderIngestionResult>>;
  replayThread(input: ServiceAuditContext & {
    connectionId: EntityId | null;
    providerThreadId: string;
  }): Promise<ServiceResult<ProviderIngestionResult[]>>;
  retryFailedIngestion(input: ServiceAuditContext & {
    receiptId: EntityId;
  }): Promise<ServiceResult<ProviderIngestionResult>>;
  markFailedIngestionReviewed(input: ServiceAuditContext & {
    receiptId: EntityId;
  }): Promise<ServiceResult<ProviderMessageReceipt>>;
  reconcileThreadMapping(input: ServiceAuditContext & {
    providerThreadId: string;
    connectionId: EntityId | null;
  }): Promise<ServiceResult<ProviderThreadReconciliationResult>>;
  reconcileReceipt(input: ServiceAuditContext & {
    receiptId: EntityId;
  }): Promise<ServiceResult<ProviderReceiptReconciliationResult>>;
}

export interface ProviderDiagnosticsService {
  getConnectionHealth(input: {
    organizationId: EntityId;
    connectionId: EntityId;
  }): Promise<ServiceResult<ProviderConnectionHealthView>>;
  listRecentSyncRuns(input: {
    organizationId: EntityId;
    connectionId?: EntityId | null;
    limit?: number;
  }): Promise<ServiceResult<ProviderSyncRun[]>>;
  listFailedIngestions(input: {
    organizationId: EntityId;
    connectionId?: EntityId | null;
    limit?: number;
  }): Promise<ServiceResult<ProviderMessageReceipt[]>>;
  listDuplicateDetections(input: {
    organizationId: EntityId;
    connectionId?: EntityId | null;
    limit?: number;
  }): Promise<ServiceResult<ProviderMessageReceipt[]>>;
  findReceipt(input: {
    organizationId: EntityId;
    receiptId?: EntityId | null;
    providerMessageId?: string | null;
  }): Promise<ServiceResult<ProviderMessageReceipt | null>>;
  findThreadMapping(input: {
    organizationId: EntityId;
    connectionId?: EntityId | null;
    providerThreadId: string;
  }): Promise<ServiceResult<ProviderThreadMapping | null>>;
  listAttachmentHydrationStatus(input: {
    organizationId: EntityId;
    connectionId?: EntityId | null;
    limit?: number;
  }): Promise<ServiceResult<CommunicationAttachment[]>>;
}

export interface ProviderBoundaryService {
  buildPollMailboxRequest(input: {
    connection: ProviderConnection;
    checkpoint: ProviderSyncCheckpoint | null;
    mailboxScope: ProviderMailboxScope;
    forceFullResync?: boolean;
    replayFailedReceipts?: boolean;
  }): PollMailboxRequest;
  normalizeWebhookEvent(input: {
    providerKey: ProviderConnection["providerKey"];
    connectionId: EntityId | null;
    mailboxScope: ProviderMailboxScope;
    providerEventType: string;
    providerEventId?: string | null;
    occurredAt?: string | null;
    payload: Record<string, unknown>;
  }): ProviderWebhookEventEnvelope;
  buildReplayJobRequest(input: {
    organizationId: EntityId;
    tenantId: EntityId;
    providerKey: ProviderConnection["providerKey"];
    connectionId: EntityId | null;
    receiptId?: EntityId | null;
    providerMessageId?: string | null;
    providerThreadId?: string | null;
    requestedByUserId?: EntityId | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }): ProviderReplayJobRequest;
}

export interface ProviderConnectionHealthView {
  connection: ProviderConnection;
  checkpoints: ProviderSyncCheckpoint[];
  recentRuns: ProviderSyncRun[];
  failedReceiptCount: number;
}

export interface ProviderThreadReconciliationResult {
  mappingFound: boolean;
  mapping: { id: EntityId; canonicalThreadId: EntityId } | null;
  receiptIds: EntityId[];
  status: "ok" | "conflict" | "missing";
}

export interface ProviderReceiptReconciliationResult {
  receiptId: EntityId;
  status: "ok" | "missing_canonical_records" | "missing_thread_mapping";
  canonicalThreadId: EntityId | null;
  canonicalMessageId: EntityId | null;
  intakeEventId: EntityId | null;
}

export interface ProviderDomainServices {
  query: ProviderConnectionQueryService;
  connections: ProviderConnectionManagementService;
  checkpoints: ProviderCheckpointService;
  syncRuns: ProviderSyncRunService;
  replay: ProviderReplayService;
  attachments: {
    hydrate(input: HydrateProviderAttachmentInput): Promise<ServiceResult<CommunicationAttachment>>;
  };
  diagnostics: ProviderDiagnosticsService;
  boundaries: ProviderBoundaryService;
}

export function createProviderServices(
  repositories: Pick<
    FirestoreRepositories,
    | "communicationAttachments"
    | "communicationMessages"
    | "communicationThreads"
    | "intakeArtifacts"
    | "providerConnections"
    | "providerMessageReceipts"
    | "providerSyncCheckpoints"
    | "providerSyncRuns"
    | "providerThreadMappings"
  >,
  dependencies: {
    domainEvents: DomainEventService;
    intake: IntakeDomainServices;
    attachmentSource?: ProviderAttachmentHydrationSource;
  },
): ProviderDomainServices {
  const service = new ProviderRuntimeService(repositories, dependencies);
  return {
    query: service,
    connections: service,
    checkpoints: service,
    syncRuns: service,
    replay: service,
    attachments: {
      hydrate: (input) => service.hydrateAttachment(input),
    },
    diagnostics: service,
    boundaries: service,
  };
}

class ProviderRuntimeService
  implements
    ProviderConnectionQueryService,
    ProviderConnectionManagementService,
    ProviderCheckpointService,
    ProviderSyncRunService,
    ProviderReplayService,
    ProviderDiagnosticsService,
    ProviderBoundaryService
{
  constructor(
    private readonly repositories: Pick<
      FirestoreRepositories,
      | "communicationAttachments"
      | "communicationMessages"
      | "communicationThreads"
      | "intakeArtifacts"
      | "providerConnections"
      | "providerMessageReceipts"
      | "providerSyncCheckpoints"
      | "providerSyncRuns"
      | "providerThreadMappings"
    >,
    private readonly dependencies: {
      domainEvents: DomainEventService;
      intake: IntakeDomainServices;
      attachmentSource?: ProviderAttachmentHydrationSource;
    },
  ) {}

  async listConnections(organizationId: EntityId): Promise<ServiceResult<ProviderConnection[]>> {
    const result = await this.repositories.providerConnections.listByOrganizationId(organizationId, { limit: 100 });
    return serviceOk(result.items);
  }

  async listSyncCheckpoints(providerConnectionId: EntityId): Promise<ServiceResult<ProviderSyncCheckpoint[]>> {
    const result = await this.repositories.providerSyncCheckpoints.listByConnectionId(providerConnectionId, { limit: 100 });
    return serviceOk(result.items);
  }

  async listSyncRuns(connectionId: EntityId): Promise<ServiceResult<ProviderSyncRun[]>> {
    const result = await this.repositories.providerSyncRuns.listByConnectionId(connectionId, { limit: 100 });
    return serviceOk(result.items);
  }

  async listMessageReceipts(providerConnectionId: EntityId): Promise<ServiceResult<ProviderMessageReceipt[]>> {
    const result = await this.repositories.providerMessageReceipts.listByConnectionId(providerConnectionId, { limit: 200 });
    return serviceOk(result.items);
  }

  async create(input: CreateProviderConnectionInput): Promise<ServiceResult<ProviderConnection>> {
    if (!input.mailboxAddress?.trim()) {
      return serviceFail(validationError("mailboxAddress is required."));
    }

    const existing = await this.repositories.providerConnections.findByMailboxAddress({
      organizationId: input.organizationId,
      providerKey: input.providerKey,
      mailboxAddress: input.mailboxAddress,
    });
    if (existing) {
      return serviceOk(existing);
    }

    const timestamp = input.now ?? nowIso();
    const connection: ProviderConnection = {
      id: this.repositories.providerConnections.newId(),
      organizationId: input.organizationId,
      tenantId: input.organizationId,
      providerKey: input.providerKey,
      providerTenantId: input.providerTenantId ?? null,
      providerAccountId: input.providerAccountId ?? null,
      mailboxAddress: input.mailboxAddress.trim().toLowerCase(),
      displayName: input.displayName?.trim() || null,
      scopes: [...new Set(input.scopes ?? [])],
      scopeMetadata: input.scopeMetadata ?? {},
      status: "active",
      healthStatus: "unknown",
      ownerUserId: input.ownerUserId ?? (input.actor.role === "system" ? null : input.actor.userId),
      connectedAt: timestamp,
      disabledAt: null,
      expiresAt: input.expiresAt ?? null,
      lastHealthyAt: null,
      lastError: null,
      lastSyncedAt: null,
      metadata: input.metadata ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.repositories.providerConnections.create(connection);
    await this.recordEvent(input, timestamp, {
      type: "provider_connection_created",
      entityType: "provider_connection",
      entityId: connection.id,
      label: connection.mailboxAddress,
      summary: "Created provider connection.",
      payload: {
        connectionId: connection.id,
        providerKey: connection.providerKey,
        mailboxAddress: connection.mailboxAddress,
        status: connection.status,
      },
    });
    return serviceOk(connection);
  }

  async updateStatus(input: UpdateProviderConnectionStatusInput): Promise<ServiceResult<ProviderConnection>> {
    const connection = await this.repositories.providerConnections.getById(input.connectionId);
    if (!connection || connection.organizationId !== input.organizationId) {
      return serviceFail(notFoundError("Provider connection could not be found."));
    }

    const updatedAt = input.now ?? nowIso();
    const updated: ProviderConnection = {
      ...connection,
      status: input.status,
      healthStatus: input.healthStatus ?? connection.healthStatus,
      disabledAt: input.status === "disabled" ? updatedAt : connection.disabledAt,
      lastHealthyAt:
        (input.healthStatus ?? connection.healthStatus) === "healthy"
          ? updatedAt
          : connection.lastHealthyAt,
      lastError:
        input.errorMessage || input.errorCode
          ? {
              code: input.errorCode ?? null,
              message: input.errorMessage ?? null,
              occurredAt: updatedAt,
              details: input.errorDetails ?? {},
            }
          : connection.lastError,
      updatedAt,
    };
    await this.repositories.providerConnections.save(updated);
    await this.recordEvent(input, updatedAt, {
      type: "provider_connection_status_changed",
      entityType: "provider_connection",
      entityId: updated.id,
      label: updated.mailboxAddress,
      summary: `Provider connection status changed to ${updated.status}.`,
      payload: {
        connectionId: updated.id,
        previousStatus: connection.status,
        nextStatus: updated.status,
        healthStatus: updated.healthStatus,
      },
    });
    return serviceOk(updated);
  }

  async upsert(input: UpsertProviderCheckpointInput): Promise<ServiceResult<ProviderSyncCheckpoint>> {
    const existing = await this.repositories.providerSyncCheckpoints.findByScope({
      organizationId: input.organizationId,
      providerConnectionId: input.connectionId ?? null,
      checkpointType: input.checkpointType,
      mailboxAddress: input.mailboxScope.mailboxAddress,
      folderId: input.mailboxScope.folderId,
    });
    const timestamp = input.now ?? nowIso();

    if (existing) {
      const updated: ProviderSyncCheckpoint = {
        ...existing,
        cursor: input.cursor ?? existing.cursor,
        mailboxScope: input.mailboxScope,
        lastProcessedReceivedAt: input.lastProcessedReceivedAt ?? existing.lastProcessedReceivedAt,
        metadata: { ...existing.metadata, ...(input.metadata ?? {}) },
        updatedAt: timestamp,
      };
      await this.repositories.providerSyncCheckpoints.save(updated);
      return serviceOk(updated);
    }

    const checkpoint: ProviderSyncCheckpoint = {
      id: this.repositories.providerSyncCheckpoints.newId(),
      organizationId: input.organizationId,
      tenantId: input.organizationId,
      providerKey: input.providerKey,
      providerConnectionId: input.connectionId ?? null,
      checkpointType: input.checkpointType,
      mailboxScope: input.mailboxScope,
      cursor: input.cursor ?? null,
      lastProcessedReceivedAt: input.lastProcessedReceivedAt ?? null,
      lastAttemptedAt: null,
      lastSuccessfulSyncAt: null,
      status: "idle",
      failureCount: 0,
      lastError: null,
      nextRetryAt: null,
      metadata: input.metadata ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.repositories.providerSyncCheckpoints.create(checkpoint);
    return serviceOk(checkpoint);
  }

  async recordAttempt(input: RecordProviderCheckpointAttemptInput): Promise<ServiceResult<ProviderSyncCheckpoint>> {
    const checkpoint = await this.loadCheckpoint(input);
    if (!checkpoint.ok) {
      return checkpoint;
    }
    const updated: ProviderSyncCheckpoint = {
      ...checkpoint.value,
      lastAttemptedAt: input.now ?? nowIso(),
      status: "running",
      nextRetryAt: input.nextRetryAt ?? null,
      updatedAt: input.now ?? nowIso(),
    };
    await this.repositories.providerSyncCheckpoints.save(updated);
    return serviceOk(updated);
  }

  async recordSuccess(input: RecordProviderCheckpointSuccessInput): Promise<ServiceResult<ProviderSyncCheckpoint>> {
    const checkpoint = await this.loadCheckpoint(input);
    if (!checkpoint.ok) {
      return checkpoint;
    }
    const timestamp = input.now ?? nowIso();
    const updated: ProviderSyncCheckpoint = {
      ...checkpoint.value,
      cursor: input.cursor ?? checkpoint.value.cursor,
      lastProcessedReceivedAt: input.lastProcessedReceivedAt ?? checkpoint.value.lastProcessedReceivedAt,
      lastAttemptedAt: checkpoint.value.lastAttemptedAt ?? timestamp,
      lastSuccessfulSyncAt: timestamp,
      status: "idle",
      failureCount: 0,
      lastError: null,
      nextRetryAt: null,
      updatedAt: timestamp,
    };
    await this.repositories.providerSyncCheckpoints.save(updated);
    return serviceOk(updated);
  }

  async recordFailure(input: RecordProviderCheckpointFailureInput): Promise<ServiceResult<ProviderSyncCheckpoint>> {
    const checkpoint = await this.loadCheckpoint(input);
    if (!checkpoint.ok) {
      return checkpoint;
    }
    const timestamp = input.now ?? nowIso();
    const updated: ProviderSyncCheckpoint = {
      ...checkpoint.value,
      lastAttemptedAt: checkpoint.value.lastAttemptedAt ?? timestamp,
      status: "error",
      failureCount: checkpoint.value.failureCount + 1,
      lastError: {
        code: input.errorCode ?? null,
        message: input.errorMessage,
        occurredAt: timestamp,
        details: input.errorDetails ?? {},
      },
      nextRetryAt: input.nextRetryAt ?? null,
      updatedAt: timestamp,
    };
    await this.repositories.providerSyncCheckpoints.save(updated);
    return serviceOk(updated);
  }

  async start(input: StartProviderSyncRunInput): Promise<ServiceResult<ProviderSyncRun>> {
    const connection = await this.loadConnection(input.organizationId, input.connectionId);
    if (!connection) {
      return serviceFail(notFoundError("Provider connection could not be found."));
    }
    const checkpoint = input.checkpointId
      ? await this.repositories.providerSyncCheckpoints.getById(input.checkpointId)
      : null;
    const timestamp = input.now ?? nowIso();
    const run: ProviderSyncRun = {
      id: this.repositories.providerSyncRuns.newId(),
      organizationId: input.organizationId,
      tenantId: input.organizationId,
      connectionId: connection.id,
      providerKey: connection.providerKey,
      mailboxScope: input.mailboxScope,
      startedAt: timestamp,
      completedAt: null,
      status: "running",
      messagesSeen: 0,
      messagesIngested: 0,
      duplicatesSkipped: 0,
      failures: 0,
      checkpointBefore: checkpoint ? snapshotCheckpoint(checkpoint) : null,
      checkpointAfter: null,
      errorSummary: null,
      claim: {
        claimedBy: null,
        claimToken: null,
        claimVersion: 0,
        claimedAt: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        releasedAt: null,
        reclaimedAt: null,
        reclaimedBy: null,
        reclaimCount: 0,
      },
      metadata: input.metadata ?? {},
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.repositories.providerSyncRuns.create(run);
    await this.recordEvent(input, timestamp, {
      type: "provider_sync_started",
      entityType: "provider_sync_run",
      entityId: run.id,
      label: connection.mailboxAddress,
      summary: "Provider sync run started.",
      payload: {
        connectionId: connection.id,
        syncRunId: run.id,
        checkpointId: input.checkpointId ?? null,
        mailboxAddress: input.mailboxScope.mailboxAddress,
        folderId: input.mailboxScope.folderId,
      },
    });
    return serviceOk(run);
  }

  async complete(input: CompleteProviderSyncRunInput): Promise<ServiceResult<ProviderSyncRun>> {
    const existing = await this.loadSyncRun(input.organizationId, input.syncRunId);
    if (!existing.ok) {
      return existing;
    }
    const timestamp = input.now ?? nowIso();
    const updated = await this.repositories.providerSyncRuns.mutateWithActiveClaim({
      organizationId: input.organizationId,
      syncRunId: input.syncRunId,
      claimedBy: input.claimedBy,
      claimToken: input.claimToken,
      now: timestamp,
      mutate: (run) => ({
        ...run,
        completedAt: timestamp,
        status: "completed",
        messagesSeen: input.messagesSeen,
        messagesIngested: input.messagesIngested,
        duplicatesSkipped: input.duplicatesSkipped,
        failures: input.failures,
        checkpointAfter: input.checkpointAfter ?? run.checkpointAfter,
        updatedAt: timestamp,
        claim: {
          ...run.claim,
          claimedBy: null,
          claimToken: null,
          leaseExpiresAt: null,
          heartbeatAt: timestamp,
          releasedAt: timestamp,
        },
      }),
    });
    if (!updated) {
      return serviceFail(validationError("Provider sync run claim changed or expired before completion."));
    }
    await this.recordEvent(input, timestamp, {
      type: "provider_sync_completed",
      entityType: "provider_sync_run",
      entityId: updated.id,
      label: updated.mailboxScope.mailboxAddress,
      summary: "Provider sync run completed.",
      payload: {
        connectionId: updated.connectionId,
        syncRunId: updated.id,
        checkpointId: input.checkpointId ?? null,
        messagesSeen: updated.messagesSeen,
        messagesIngested: updated.messagesIngested,
        duplicatesSkipped: updated.duplicatesSkipped,
        failures: updated.failures,
      },
    });
    return serviceOk(updated);
  }

  async fail(input: FailProviderSyncRunInput): Promise<ServiceResult<ProviderSyncRun>> {
    const existing = await this.loadSyncRun(input.organizationId, input.syncRunId);
    if (!existing.ok) {
      return existing;
    }
    const timestamp = input.now ?? nowIso();
    const updated = await this.repositories.providerSyncRuns.mutateWithActiveClaim({
      organizationId: input.organizationId,
      syncRunId: input.syncRunId,
      claimedBy: input.claimedBy,
      claimToken: input.claimToken,
      now: timestamp,
      mutate: (run) => ({
        ...run,
        completedAt: timestamp,
        status: "failed",
        failures: input.failures,
        checkpointAfter: input.checkpointAfter ?? run.checkpointAfter,
        errorSummary: input.reason,
        updatedAt: timestamp,
        claim: {
          ...run.claim,
          claimedBy: null,
          claimToken: null,
          leaseExpiresAt: null,
          heartbeatAt: timestamp,
          releasedAt: timestamp,
        },
      }),
    });
    if (!updated) {
      return serviceFail(validationError("Provider sync run claim changed or expired before failure handling."));
    }
    await this.recordEvent(input, timestamp, {
      type: "provider_sync_failed",
      entityType: "provider_sync_run",
      entityId: updated.id,
      label: updated.mailboxScope.mailboxAddress,
      summary: "Provider sync run failed.",
      payload: {
        connectionId: updated.connectionId,
        syncRunId: updated.id,
        checkpointId: input.checkpointId ?? null,
        reason: input.reason,
        failures: updated.failures,
      },
    });
    return serviceOk(updated);
  }

  async claim(input: { syncRunId: EntityId; claim: ProviderSyncRunClaim }): Promise<ServiceResult<ProviderSyncRun>> {
    const existing = await this.repositories.providerSyncRuns.getById(input.syncRunId);
    if (!existing) {
      return serviceFail(notFoundError("Provider sync run could not be found."));
    }
    const updated = await this.repositories.providerSyncRuns.claimRun({
      organizationId: existing.organizationId,
      syncRunId: input.syncRunId,
      claimedBy: input.claim.claimedBy,
      claimedAt: input.claim.claimedAt,
      leaseExpiresAt: input.claim.leaseExpiresAt,
    });
    if (!updated) {
      return serviceFail(validationError("Provider sync run already has an active claim."));
    }
    return serviceOk(updated);
  }

  async release(input: ServiceAuditContext & {
    syncRunId: EntityId;
    claimedBy: string;
    claimToken: string;
  }): Promise<ServiceResult<ProviderSyncRun>> {
    const existing = await this.loadSyncRun(input.organizationId, input.syncRunId);
    if (!existing.ok) {
      return existing;
    }
    const timestamp = input.now ?? nowIso();
    const updated = await this.repositories.providerSyncRuns.mutateWithActiveClaim({
      organizationId: input.organizationId,
      syncRunId: input.syncRunId,
      claimedBy: input.claimedBy,
      claimToken: input.claimToken,
      now: timestamp,
      mutate: (run) => ({
        ...run,
        status: run.status === "running" ? "released" : run.status,
        claim: {
          ...run.claim,
          claimedBy: null,
          claimToken: null,
          leaseExpiresAt: null,
          heartbeatAt: timestamp,
          releasedAt: timestamp,
        },
        updatedAt: timestamp,
      }),
    });
    if (!updated) {
      return serviceFail(validationError("Provider sync run claim changed or expired before release."));
    }
    return serviceOk(updated);
  }

  async replayMessageByProviderMessageId(input: ServiceAuditContext & {
    providerMessageId: string;
  }): Promise<ServiceResult<ProviderIngestionResult>> {
    const receiptResult = await this.findReceipt({
      organizationId: input.organizationId,
      providerMessageId: input.providerMessageId,
    });
    if (!receiptResult.ok) {
      return receiptResult;
    }
    if (!receiptResult.value) {
      return serviceFail(notFoundError("Provider receipt could not be found."));
    }
    return this.replayByReceiptId({ ...input, receiptId: receiptResult.value.id });
  }

  async replayByReceiptId(input: ServiceAuditContext & {
    receiptId: EntityId;
  }): Promise<ServiceResult<ProviderIngestionResult>> {
    const receipt = await this.repositories.providerMessageReceipts.getById(input.receiptId);
    if (!receipt || receipt.organizationId !== input.organizationId) {
      return serviceFail(notFoundError("Provider receipt could not be found."));
    }

    await this.recordEvent(input, input.now ?? nowIso(), {
      type: "provider_replay_requested",
      entityType: "provider_message_receipt",
      entityId: receipt.id,
      label: receipt.providerMessageId,
      summary: "Provider replay requested.",
      payload: {
        receiptId: receipt.id,
        providerMessageId: receipt.providerMessageId,
        providerThreadId: receipt.providerThreadId,
      },
    });

    if (receipt.status === "ingested" && receipt.intakeEventId && receipt.canonicalMessageId) {
      const result = await this.dependencies.intake.ingestion.ingestProviderPayload({
        ...input,
        payload: this.requireReplayPayload(receipt),
        replayMode: "allow_existing_success",
      });
      if (!result.ok) {
        return result;
      }
      await this.recordEvent(input, input.now ?? nowIso(), {
        type: "provider_replay_completed",
        entityType: "provider_message_receipt",
        entityId: receipt.id,
        label: receipt.providerMessageId,
        summary: "Provider replay completed using existing canonical records.",
        payload: {
          receiptId: receipt.id,
          replayReceiptId: result.value.providerMessageReceipt.id,
          canonicalMessageId: result.value.communicationMessage?.id ?? null,
        },
      });
      return result;
    }

    return this.retryFailedIngestion({ ...input, receiptId: receipt.id });
  }

  async replayThread(input: ServiceAuditContext & {
    connectionId: EntityId | null;
    providerThreadId: string;
  }): Promise<ServiceResult<ProviderIngestionResult[]>> {
    const receipts = (await this.repositories.providerMessageReceipts.listByOrganizationId(input.organizationId, { limit: 500 })).items
      .filter((receipt) => receipt.providerConnectionId === input.connectionId)
      .filter((receipt) => receipt.providerThreadId === input.providerThreadId)
      .sort((left, right) => left.receivedAt.localeCompare(right.receivedAt));

    const results: ProviderIngestionResult[] = [];
    for (const receipt of receipts) {
      const replayed = await this.replayByReceiptId({ ...input, receiptId: receipt.id });
      if (replayed.ok) {
        results.push(replayed.value);
      }
    }

    return serviceOk(results);
  }

  async retryFailedIngestion(input: ServiceAuditContext & {
    receiptId: EntityId;
  }): Promise<ServiceResult<ProviderIngestionResult>> {
    const receipt = await this.repositories.providerMessageReceipts.getById(input.receiptId);
    if (!receipt || receipt.organizationId !== input.organizationId) {
      return serviceFail(notFoundError("Provider receipt could not be found."));
    }
    if (receipt.status !== "failed" && receipt.status !== "rejected") {
      return this.replayByReceiptId(input);
    }

    const payload = this.requireReplayPayload(receipt);
    const result = await this.dependencies.intake.ingestion.ingestProviderPayload({
      ...input,
      payload,
      replayMode: "retry_failed_receipt",
      replaySourceReceiptId: receipt.id,
    });
    if (!result.ok) {
      return result;
    }

    const updatedReceipt: ProviderMessageReceipt = {
      ...receipt,
      supersededByReceiptId: result.value.providerMessageReceipt.id,
      reviewedAt: receipt.reviewedAt,
      reviewedByUserId: receipt.reviewedByUserId,
      metadata: {
        ...receipt.metadata,
        supersededAt: input.now ?? nowIso(),
      },
    };
    await this.repositories.providerMessageReceipts.save(updatedReceipt);

    await this.recordEvent(input, input.now ?? nowIso(), {
      type: "provider_replay_completed",
      entityType: "provider_message_receipt",
      entityId: receipt.id,
      label: receipt.providerMessageId,
      summary: "Provider failed ingestion replay completed.",
      payload: {
        receiptId: receipt.id,
        replayReceiptId: result.value.providerMessageReceipt.id,
        canonicalMessageId: result.value.communicationMessage?.id ?? null,
      },
    });
    return result;
  }

  async markFailedIngestionReviewed(input: ServiceAuditContext & {
    receiptId: EntityId;
  }): Promise<ServiceResult<ProviderMessageReceipt>> {
    const receipt = await this.repositories.providerMessageReceipts.getById(input.receiptId);
    if (!receipt || receipt.organizationId !== input.organizationId) {
      return serviceFail(notFoundError("Provider receipt could not be found."));
    }
    const updated: ProviderMessageReceipt = {
      ...receipt,
      reviewedAt: input.now ?? nowIso(),
      reviewedByUserId: input.actor.role === "system" ? null : input.actor.userId,
      metadata: {
        ...receipt.metadata,
        reviewStatus: "reviewed",
      },
    };
    await this.repositories.providerMessageReceipts.save(updated);
    return serviceOk(updated);
  }

  async reconcileThreadMapping(input: ServiceAuditContext & {
    providerThreadId: string;
    connectionId: EntityId | null;
  }): Promise<ServiceResult<ProviderThreadReconciliationResult>> {
    const mapping = await this.unsafeFindThreadMapping({
      organizationId: input.organizationId,
      connectionId: input.connectionId,
      providerThreadId: input.providerThreadId,
    });
    const receipts = (await this.repositories.providerMessageReceipts.listByOrganizationId(input.organizationId, { limit: 500 })).items
      .filter((receipt) => receipt.providerConnectionId === input.connectionId)
      .filter((receipt) => receipt.providerThreadId === input.providerThreadId);

    const receiptThreadIds = [...new Set(receipts.map((receipt) => receipt.canonicalThreadId).filter(Boolean))] as EntityId[];
    let status: ProviderThreadReconciliationResult["status"] = "missing";
    if (mapping && receiptThreadIds.length <= 1 && receiptThreadIds[0] === mapping.canonicalThreadId) {
      status = "ok";
    } else if (mapping || receiptThreadIds.length > 0) {
      status = "conflict";
    }

    const result: ProviderThreadReconciliationResult = {
      mappingFound: Boolean(mapping),
      mapping: mapping ? { id: mapping.id, canonicalThreadId: mapping.canonicalThreadId } : null,
      receiptIds: receipts.map((receipt) => receipt.id),
      status,
    };

    await this.recordEvent(input, input.now ?? nowIso(), {
      type: "provider_reconciliation_completed",
      entityType: mapping ? "provider_thread_mapping" : "provider_connection",
      entityId: mapping?.id ?? (input.connectionId ?? input.organizationId),
      label: input.providerThreadId,
      summary: `Provider thread reconciliation ${result.status}.`,
      payload: {
        connectionId: input.connectionId,
        providerThreadId: input.providerThreadId,
        receiptId: null,
        status: result.status,
      },
    });

    return serviceOk(result);
  }

  async reconcileReceipt(input: ServiceAuditContext & {
    receiptId: EntityId;
  }): Promise<ServiceResult<ProviderReceiptReconciliationResult>> {
    const receipt = await this.repositories.providerMessageReceipts.getById(input.receiptId);
    if (!receipt || receipt.organizationId !== input.organizationId) {
      return serviceFail(notFoundError("Provider receipt could not be found."));
    }
    const message = receipt.canonicalMessageId
      ? await this.repositories.communicationMessages.getById(receipt.canonicalMessageId)
      : null;
    const thread = receipt.canonicalThreadId
      ? await this.repositories.communicationThreads.getById(receipt.canonicalThreadId)
      : null;
    const mapping = receipt.providerThreadId
      ? await this.repositories.providerThreadMappings.findByProviderThread({
          organizationId: input.organizationId,
          providerKey: receipt.providerKey,
          providerConnectionId: receipt.providerConnectionId,
          providerThreadId: receipt.providerThreadId,
        })
      : null;

    const status: ProviderReceiptReconciliationResult["status"] =
      !message || !thread || !receipt.intakeEventId
        ? "missing_canonical_records"
        : !mapping
          ? "missing_thread_mapping"
          : "ok";

    const result: ProviderReceiptReconciliationResult = {
      receiptId: receipt.id,
      status,
      canonicalThreadId: receipt.canonicalThreadId,
      canonicalMessageId: receipt.canonicalMessageId,
      intakeEventId: receipt.intakeEventId,
    };

    await this.recordEvent(input, input.now ?? nowIso(), {
      type: "provider_reconciliation_completed",
      entityType: "provider_message_receipt",
      entityId: receipt.id,
      label: receipt.providerMessageId,
      summary: `Provider receipt reconciliation ${status}.`,
      payload: {
        connectionId: receipt.providerConnectionId,
        providerThreadId: receipt.providerThreadId,
        receiptId: receipt.id,
        status,
      },
    });

    return serviceOk(result);
  }

  async hydrateAttachment(input: HydrateProviderAttachmentInput): Promise<ServiceResult<CommunicationAttachment>> {
    const attachment = await this.repositories.communicationAttachments.getById(input.attachmentId);
    if (!attachment || attachment.organizationId !== input.organizationId) {
      return serviceFail(notFoundError("Communication attachment could not be found."));
    }
    if (!attachment.externalProvider || !attachment.externalAttachmentId) {
      return serviceFail(validationError("Attachment is not provider-backed and cannot be hydrated."));
    }
    if (!this.dependencies.attachmentSource) {
      return serviceFail(validationError("No provider attachment hydration source is configured."));
    }

    const startedAt = input.now ?? nowIso();
    await this.recordEvent(input, startedAt, {
      type: "provider_attachment_hydration_started",
      entityType: "communication_attachment",
      entityId: attachment.id,
      label: attachment.fileName,
      summary: `Attachment hydration started for ${attachment.fileName}.`,
      payload: {
        attachmentId: attachment.id,
        providerAttachmentId: attachment.externalAttachmentId,
        providerKey: attachment.externalProvider,
      },
    });

    try {
      const hydrated = await this.dependencies.attachmentSource.getAttachmentContent({ attachment });
      if (
        input.expectedMimeTypes?.length &&
        hydrated.mimeType &&
        !input.expectedMimeTypes.includes(hydrated.mimeType)
      ) {
        throw new Error("Provider attachment MIME type did not match the expected allow-list.");
      }
      if (input.maximumSizeBytes != null && hydrated.sizeBytes > input.maximumSizeBytes) {
        throw new Error("Provider attachment exceeded the maximum allowed size.");
      }

      const updated: CommunicationAttachment = {
        ...attachment,
        contentType: hydrated.mimeType ?? attachment.contentType,
        sizeBytes: hydrated.sizeBytes,
        storagePath: input.storagePath ?? hydrated.storagePath ?? attachment.storagePath,
        hydrationStatus: "hydrated",
        hydratedAt: startedAt,
        hydrationError: null,
        contentHash: hydrated.contentHash ?? hashBytes(hydrated.content),
        metadata: {
          ...attachment.metadata,
          lastHydrationSizeBytes: hydrated.sizeBytes,
        },
      };
      await this.repositories.communicationAttachments.save(updated);
      await this.recordEvent(input, startedAt, {
        type: "provider_attachment_hydration_completed",
        entityType: "communication_attachment",
        entityId: updated.id,
        label: updated.fileName,
        summary: `Attachment hydration completed for ${updated.fileName}.`,
        payload: {
          attachmentId: updated.id,
          contentHash: updated.contentHash,
          storagePath: updated.storagePath,
        },
      });
      return serviceOk(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "attachment_hydration_failed";
      const failed: CommunicationAttachment = {
        ...attachment,
        hydrationStatus: "failed",
        hydratedAt: null,
        hydrationError: message,
      };
      await this.repositories.communicationAttachments.save(failed);
      await this.recordEvent(input, startedAt, {
        type: "provider_attachment_hydration_failed",
        entityType: "communication_attachment",
        entityId: failed.id,
        label: failed.fileName,
        summary: `Attachment hydration failed for ${failed.fileName}.`,
        payload: {
          attachmentId: failed.id,
          reason: message,
        },
      });
      return serviceFail(validationError(message));
    }
  }

  async getConnectionHealth(input: {
    organizationId: EntityId;
    connectionId: EntityId;
  }): Promise<ServiceResult<ProviderConnectionHealthView>> {
    const connection = await this.repositories.providerConnections.getById(input.connectionId);
    if (!connection || connection.organizationId !== input.organizationId) {
      return serviceFail(notFoundError("Provider connection could not be found."));
    }
    const [checkpoints, runs, receipts] = await Promise.all([
      this.repositories.providerSyncCheckpoints.listByConnectionId(input.connectionId, { limit: 20 }),
      this.repositories.providerSyncRuns.listByConnectionId(input.connectionId, { limit: 20 }),
      this.repositories.providerMessageReceipts.listByConnectionId(input.connectionId, { limit: 200 }),
    ]);

    return serviceOk({
      connection,
      checkpoints: checkpoints.items,
      recentRuns: runs.items,
      failedReceiptCount: receipts.items.filter((item) => item.status === "failed" || item.status === "rejected").length,
    });
  }

  async listRecentSyncRuns(input: {
    organizationId: EntityId;
    connectionId?: EntityId | null;
    limit?: number;
  }): Promise<ServiceResult<ProviderSyncRun[]>> {
    const items = input.connectionId
      ? (await this.repositories.providerSyncRuns.listByConnectionId(input.connectionId, { limit: input.limit ?? 50 })).items
      : (await this.repositories.providerSyncRuns.listByOrganizationId(input.organizationId, { limit: input.limit ?? 50 })).items;
    return serviceOk(items.filter((item) => item.organizationId === input.organizationId));
  }

  async listFailedIngestions(input: {
    organizationId: EntityId;
    connectionId?: EntityId | null;
    limit?: number;
  }): Promise<ServiceResult<ProviderMessageReceipt[]>> {
    const receipts = await this.repositories.providerMessageReceipts.listByOrganizationId(input.organizationId, { limit: input.limit ?? 200 });
    return serviceOk(
      receipts.items
        .filter((item) => !input.connectionId || item.providerConnectionId === input.connectionId)
        .filter((item) => item.status === "failed" || item.status === "rejected"),
    );
  }

  async listDuplicateDetections(input: {
    organizationId: EntityId;
    connectionId?: EntityId | null;
    limit?: number;
  }): Promise<ServiceResult<ProviderMessageReceipt[]>> {
    const receipts = await this.repositories.providerMessageReceipts.listByOrganizationId(input.organizationId, { limit: input.limit ?? 200 });
    return serviceOk(
      receipts.items
        .filter((item) => !input.connectionId || item.providerConnectionId === input.connectionId)
        .filter((item) => item.status === "duplicate" || Boolean(item.metadata?.duplicateDetectedAt)),
    );
  }

  async findReceipt(input: {
    organizationId: EntityId;
    receiptId?: EntityId | null;
    providerMessageId?: string | null;
  }): Promise<ServiceResult<ProviderMessageReceipt | null>> {
    if (input.receiptId) {
      const receipt = await this.repositories.providerMessageReceipts.getById(input.receiptId);
      return serviceOk(receipt?.organizationId === input.organizationId ? receipt : null);
    }

    if (input.providerMessageId) {
      const receipts = await this.repositories.providerMessageReceipts.listByOrganizationId(input.organizationId, { limit: 500 });
      return serviceOk(receipts.items.find((item) => item.providerMessageId === input.providerMessageId) ?? null);
    }

    return serviceOk(null);
  }

  async findThreadMapping(input: {
    organizationId: EntityId;
    connectionId?: EntityId | null;
    providerThreadId: string;
  }): Promise<ServiceResult<ProviderThreadMapping | null>> {
    return serviceOk(await this.unsafeFindThreadMapping(input));
  }

  async listAttachmentHydrationStatus(input: {
    organizationId: EntityId;
    connectionId?: EntityId | null;
    limit?: number;
  }): Promise<ServiceResult<CommunicationAttachment[]>> {
    const receipts = await this.repositories.providerMessageReceipts.listByOrganizationId(input.organizationId, { limit: input.limit ?? 200 });
    const attachmentIds = new Set(
      receipts.items
        .filter((item) => !input.connectionId || item.providerConnectionId === input.connectionId)
        .flatMap((item) => item.attachmentIds),
    );
    const attachments = (await Promise.all([...attachmentIds].map((attachmentId) => this.repositories.communicationAttachments.getById(attachmentId))))
      .filter((item): item is CommunicationAttachment => Boolean(item && item.organizationId === input.organizationId));
    return serviceOk(attachments);
  }

  buildPollMailboxRequest(input: {
    connection: ProviderConnection;
    checkpoint: ProviderSyncCheckpoint | null;
    mailboxScope: ProviderMailboxScope;
    forceFullResync?: boolean;
    replayFailedReceipts?: boolean;
  }): PollMailboxRequest {
    return {
      organizationId: input.connection.organizationId,
      tenantId: input.connection.tenantId,
      connectionId: input.connection.id,
      providerKey: input.connection.providerKey,
      mailboxScope: input.mailboxScope,
      requestedAt: nowIso(),
      requestedByUserId: input.connection.ownerUserId,
      forceFullResync: Boolean(input.forceFullResync),
      replayFailedReceipts: Boolean(input.replayFailedReceipts),
      metadata: {},
      checkpointId: input.checkpoint?.id ?? null,
      cursor: input.forceFullResync ? null : input.checkpoint?.cursor ?? null,
    };
  }

  normalizeWebhookEvent(input: {
    providerKey: ProviderConnection["providerKey"];
    connectionId: EntityId | null;
    mailboxScope: ProviderMailboxScope;
    providerEventType: string;
    providerEventId?: string | null;
    occurredAt?: string | null;
    payload: Record<string, unknown>;
  }): ProviderWebhookEventEnvelope {
    return {
      providerKey: input.providerKey,
      connectionId: input.connectionId ?? null,
      mailboxScope: input.mailboxScope,
      providerEventId: input.providerEventId ?? null,
      providerEventType: input.providerEventType,
      occurredAt: input.occurredAt ?? nowIso(),
      payload: input.payload,
    };
  }

  buildReplayJobRequest(input: {
    organizationId: EntityId;
    tenantId: EntityId;
    providerKey: ProviderConnection["providerKey"];
    connectionId: EntityId | null;
    receiptId?: EntityId | null;
    providerMessageId?: string | null;
    providerThreadId?: string | null;
    requestedByUserId?: EntityId | null;
    reason?: string | null;
    metadata?: Record<string, unknown>;
  }): ProviderReplayJobRequest {
    return {
      organizationId: input.organizationId,
      tenantId: input.tenantId,
      connectionId: input.connectionId ?? null,
      providerKey: input.providerKey,
      receiptId: input.receiptId ?? null,
      providerMessageId: input.providerMessageId ?? null,
      providerThreadId: input.providerThreadId ?? null,
      requestedAt: nowIso(),
      requestedByUserId: input.requestedByUserId ?? null,
      reason: input.reason ?? null,
      metadata: input.metadata ?? {},
    };
  }

  unsafeFindThreadMapping(input: {
    organizationId: EntityId;
    connectionId?: EntityId | null;
    providerThreadId: string;
  }): Promise<ProviderThreadMapping | null> {
    return this.repositories.providerThreadMappings.findByProviderThread({
      organizationId: input.organizationId,
      providerKey: "microsoft_graph",
      providerConnectionId: input.connectionId ?? null,
      providerThreadId: input.providerThreadId,
    });
  }

  private async loadCheckpoint(input: ServiceAuditContext & { checkpointId: EntityId }) {
    const checkpoint = await this.repositories.providerSyncCheckpoints.getById(input.checkpointId);
    if (!checkpoint || checkpoint.organizationId !== input.organizationId) {
      return serviceFail<ProviderSyncCheckpoint>(notFoundError("Provider sync checkpoint could not be found."));
    }
    return serviceOk(checkpoint);
  }

  private async loadSyncRun(organizationId: EntityId, syncRunId: EntityId) {
    const run = await this.repositories.providerSyncRuns.getById(syncRunId);
    if (!run || run.organizationId !== organizationId) {
      return serviceFail<ProviderSyncRun>(notFoundError("Provider sync run could not be found."));
    }
    return serviceOk(run);
  }

  private async loadConnection(organizationId: EntityId, connectionId: EntityId) {
    const connection = await this.repositories.providerConnections.getById(connectionId);
    if (!connection || connection.organizationId !== organizationId) {
      return null;
    }
    return connection;
  }

  private requireReplayPayload(receipt: ProviderMessageReceipt) {
    const payload = receipt.metadata.replayPayload;
    if (!payload || typeof payload !== "object") {
      throw validationError("Provider receipt is not replayable because no payload snapshot was stored.");
    }
    return payload as Parameters<IntakeDomainServices["ingestion"]["ingestProviderPayload"]>[0]["payload"];
  }

  private async recordEvent(
    input: ServiceAuditContext,
    occurredAt: string,
    event: {
      type: Parameters<DomainEventService["record"]>[0]["type"];
      entityType: Parameters<DomainEventService["record"]>[0]["entity"]["entityType"];
      entityId: EntityId;
      label: string | null;
      summary: string;
      payload: unknown;
    },
  ) {
    await this.dependencies.domainEvents.record({
      ...input,
      now: occurredAt,
      workOrderId: null,
      type: event.type,
      visibility: "internal",
      lifecycleStatus: null,
      entity: {
        entityType: event.entityType,
        entityId: event.entityId,
        label: event.label,
      },
      summary: event.summary,
      payload: event.payload as never,
    });
  }
}

function snapshotCheckpoint(checkpoint: ProviderSyncCheckpoint): ProviderSyncRun["checkpointBefore"] {
  return {
    id: checkpoint.id,
    cursor: checkpoint.cursor,
    lastProcessedReceivedAt: checkpoint.lastProcessedReceivedAt,
    lastAttemptedAt: checkpoint.lastAttemptedAt,
    lastSuccessfulSyncAt: checkpoint.lastSuccessfulSyncAt,
    failureCount: checkpoint.failureCount,
    nextRetryAt: checkpoint.nextRetryAt,
  };
}

function hashBytes(content: Uint8Array): string {
  return Buffer.from(content).toString("base64url");
}
