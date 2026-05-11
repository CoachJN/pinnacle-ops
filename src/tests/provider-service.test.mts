import assert from "node:assert/strict";
import test from "node:test";

import { createProviderServices } from "../server/services/provider-service.ts";
import type { DomainEvent } from "../server/events/types.ts";
import type { DomainEventService, IntakeDomainServices } from "../server/services/index.ts";
import type { ProviderIngestionResult } from "../server/services/intake-service.ts";
import type {
  CommunicationAttachment,
  CommunicationMessage,
  CommunicationThread,
} from "../modules/communications/index.ts";
import type {
  ProviderConnection,
  ProviderMessageReceipt,
  ProviderSyncCheckpoint,
  ProviderSyncRun,
  ProviderThreadMapping,
} from "../modules/providers/index.ts";
import type { NormalizedIngestionPayload } from "../modules/intake/index.ts";
import type {
  CommunicationAttachmentRepository,
  CommunicationMessageRepository,
  CommunicationThreadRepository,
  IntakeArtifactRepository,
  ProviderConnectionRepository,
  ProviderMessageReceiptRepository,
  ProviderSyncCheckpointRepository,
  ProviderSyncRunRepository,
  ProviderThreadMappingRepository,
} from "../server/repositories/index.ts";

test("provider runtime manages connection lifecycle, checkpoints, sync runs, and emits events", async () => {
  const harness = createHarness();

  const connection = await harness.providers.connections.create({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    providerKey: "microsoft_graph",
    mailboxAddress: "ops@example.com",
    scopes: ["mail.read"],
  });
  assert.equal(connection.ok, true);
  assert.equal(connection.value.status, "active");

  const updated = await harness.providers.connections.updateStatus({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    connectionId: connection.value.id,
    status: "error",
    healthStatus: "unhealthy",
    errorMessage: "token expired",
  });
  assert.equal(updated.ok, true);
  assert.equal(updated.value.status, "error");

  const checkpoint = await harness.providers.checkpoints.upsert({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    connectionId: connection.value.id,
    providerKey: "microsoft_graph",
    checkpointType: "email_delta",
    mailboxScope: mailboxScope(),
    cursor: "delta-1",
  });
  assert.equal(checkpoint.ok, true);

  const attempted = await harness.providers.checkpoints.recordAttempt({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    checkpointId: checkpoint.value.id,
  });
  assert.equal(attempted.ok, true);
  assert.equal(attempted.value.status, "running");

  const succeeded = await harness.providers.checkpoints.recordSuccess({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    checkpointId: checkpoint.value.id,
    cursor: "delta-2",
    lastProcessedReceivedAt: now(),
  });
  assert.equal(succeeded.ok, true);
  assert.equal(succeeded.value.status, "idle");

  const run = await harness.providers.syncRuns.start({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    connectionId: connection.value.id,
    checkpointId: checkpoint.value.id,
    mailboxScope: mailboxScope(),
  });
  assert.equal(run.ok, true);

  const claimed = await harness.providers.syncRuns.claim({
    syncRunId: run.value.id,
    claim: {
      runId: run.value.id,
      claimedBy: "provider-worker-1",
      claimToken: "ignored-by-repository",
      claimedAt: "2026-05-06T12:00:01.000Z",
      leaseExpiresAt: "2026-05-06T12:05:00.000Z",
    },
  });
  assert.equal(claimed.ok, true);

  const completed = await harness.providers.syncRuns.complete({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    syncRunId: run.value.id,
    claimedBy: "provider-worker-1",
    claimToken: claimed.ok ? claimed.value.claim.claimToken ?? "" : "",
    now: "2026-05-06T12:00:02.000Z",
    checkpointId: checkpoint.value.id,
    messagesSeen: 4,
    messagesIngested: 2,
    duplicatesSkipped: 1,
    failures: 1,
    checkpointAfter: {
      id: checkpoint.value.id,
      cursor: "delta-3",
      lastProcessedReceivedAt: now(),
      lastAttemptedAt: now(),
      lastSuccessfulSyncAt: now(),
      failureCount: 0,
      nextRetryAt: null,
    },
  });
  assert.equal(completed.ok, true);
  assert.equal(completed.value.status, "completed");
  assert.equal(
    harness.events.map((event) => event.type).includes("provider_sync_completed"),
    true,
  );
});

test("provider runtime retries failed ingestion idempotently and keeps tenant boundaries", async () => {
  const harness = createHarness();
  const receipt = seedFailedReceipt(harness.receipts);

  const retry = await harness.providers.replay.retryFailedIngestion({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    receiptId: receipt.id,
  });
  assert.equal(retry.ok, true);
  assert.equal(harness.ingestionCalls.length, 1);
  assert.equal(retry.value.providerMessageReceipt.id, "receipt-replayed-1");

  const updatedOriginal = harness.receipts.find((item) => item.id === receipt.id);
  assert.equal(updatedOriginal?.supersededByReceiptId, "receipt-replayed-1");
  assert.equal(
    harness.events.map((event) => event.type).includes("provider_replay_completed"),
    true,
  );

  const denied = await harness.providers.replay.markFailedIngestionReviewed({
    organizationId: "org-2",
    actor: { userId: "manager-2", role: "manager" },
    receiptId: receipt.id,
  });
  assert.equal(denied.ok, false);
});

test("provider runtime hydrates attachments, reconciles mappings, and serves diagnostics", async () => {
  const harness = createHarness();
  const connection = seedConnection(harness.connections);
  const receipt = seedIngestedReceipt(harness.receipts, connection.id);
  const attachment = seedAttachment(harness.attachments, receipt.attachmentIds[0] ?? "attachment-1");
  seedThreadArtifacts(harness.threads, harness.messages, harness.mappings, receipt, connection.id);

  const hydration = await harness.providers.attachments.hydrate({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    attachmentId: attachment.id,
    expectedMimeTypes: ["image/jpeg"],
    maximumSizeBytes: 2048,
  });
  assert.equal(hydration.ok, true);
  assert.equal(hydration.value.hydrationStatus, "hydrated");

  const thread = await harness.providers.replay.reconcileThreadMapping({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    connectionId: connection.id,
    providerThreadId: "thread-1",
  });
  assert.equal(thread.ok, true);
  assert.equal(thread.value.status, "ok");

  const receiptCheck = await harness.providers.replay.reconcileReceipt({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    receiptId: receipt.id,
  });
  assert.equal(receiptCheck.ok, true);
  assert.equal(receiptCheck.value.status, "ok");

  const health = await harness.providers.diagnostics.getConnectionHealth({
    organizationId: "org-1",
    connectionId: connection.id,
  });
  assert.equal(health.ok, true);

  const attachments = await harness.providers.diagnostics.listAttachmentHydrationStatus({
    organizationId: "org-1",
    connectionId: connection.id,
    limit: 10,
  });
  assert.equal(attachments.ok, true);
  assert.equal(attachments.value[0]?.hydrationStatus, "hydrated");
});

test("provider sync claims reject stale owners after reclaim", async () => {
  const harness = createHarness();
  const connection = seedConnection(harness.connections);
  const run = await harness.providers.syncRuns.start({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    connectionId: connection.id,
    mailboxScope: mailboxScope(),
    now: "2026-05-06T18:00:00.000Z",
  });
  assert.equal(run.ok, true);

  const firstClaim = await harness.providers.syncRuns.claim({
    syncRunId: run.value.id,
    claim: {
      runId: run.value.id,
      claimedBy: "provider-worker-a",
      claimToken: "ignored",
      claimedAt: "2026-05-06T18:00:01.000Z",
      leaseExpiresAt: "2026-05-06T18:00:30.000Z",
    },
  });
  assert.equal(firstClaim.ok, true);

  const overlappingClaim = await harness.providers.syncRuns.claim({
    syncRunId: run.value.id,
    claim: {
      runId: run.value.id,
      claimedBy: "provider-worker-b",
      claimToken: "ignored",
      claimedAt: "2026-05-06T18:00:10.000Z",
      leaseExpiresAt: "2026-05-06T18:01:00.000Z",
    },
  });
  assert.equal(overlappingClaim.ok, false);

  const reclaimed = await harness.providers.syncRuns.claim({
    syncRunId: run.value.id,
    claim: {
      runId: run.value.id,
      claimedBy: "provider-worker-b",
      claimToken: "ignored",
      claimedAt: "2026-05-06T18:00:31.000Z",
      leaseExpiresAt: "2026-05-06T18:01:30.000Z",
    },
  });
  assert.equal(reclaimed.ok, true);
  assert.equal(reclaimed.value.claim.reclaimCount, 1);

  const staleRelease = await harness.providers.syncRuns.release({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    syncRunId: run.value.id,
    claimedBy: "provider-worker-a",
    claimToken: firstClaim.ok ? firstClaim.value.claim.claimToken ?? "" : "",
    now: "2026-05-06T18:00:32.000Z",
  });
  assert.equal(staleRelease.ok, false);

  const completed = await harness.providers.syncRuns.complete({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    syncRunId: run.value.id,
    claimedBy: "provider-worker-b",
    claimToken: reclaimed.ok ? reclaimed.value.claim.claimToken ?? "" : "",
    checkpointId: null,
    messagesSeen: 2,
    messagesIngested: 1,
    duplicatesSkipped: 0,
    failures: 0,
    now: "2026-05-06T18:00:40.000Z",
  });
  assert.equal(completed.ok, true);
});

function createHarness() {
  const events: DomainEvent[] = [];
  const connections: ProviderConnection[] = [];
  const checkpoints: ProviderSyncCheckpoint[] = [];
  const syncRuns: ProviderSyncRun[] = [];
  const receipts: ProviderMessageReceipt[] = [];
  const mappings: ProviderThreadMapping[] = [];
  const attachments: CommunicationAttachment[] = [];
  const messages: CommunicationMessage[] = [];
  const threads: CommunicationThread[] = [];
  const ingestionCalls: Array<{ payload: NormalizedIngestionPayload; replayMode?: string | null }> = [];

  const providers = createProviderServices(
    {
      communicationAttachments: createCommunicationAttachmentRepository(attachments),
      communicationMessages: createCommunicationMessageRepository(messages),
      communicationThreads: createCommunicationThreadRepository(threads),
      intakeArtifacts: createEmptyIntakeArtifactRepository(),
      providerConnections: createProviderConnectionRepository(connections),
      providerMessageReceipts: createProviderMessageReceiptRepository(receipts),
      providerSyncCheckpoints: createProviderSyncCheckpointRepository(checkpoints),
      providerSyncRuns: createProviderSyncRunRepository(syncRuns),
      providerThreadMappings: createProviderThreadMappingRepository(mappings),
    },
    {
      domainEvents: {
        async record(input: Parameters<DomainEventService["record"]>[0]) {
          events.push({
            id: `event-${events.length + 1}`,
            organizationId: input.organizationId,
            tenantId: input.organizationId,
            workOrderId: input.workOrderId,
            type: input.type,
            actor: {
              actorId: input.actor.userId,
              actorType: input.actor.role === "system" ? "system" : "user",
              actorRole: input.actor.role,
              displayName: null,
            },
            visibility: input.visibility,
            occurredAt: input.now ?? now(),
            lifecycleStatus: input.lifecycleStatus,
            entity: input.entity,
            summary: input.summary,
            metadata: {
              requestId: input.requestId ?? null,
              reason: null,
              correlationId: null,
              details: {},
            },
            payload: input.payload,
          });
          return { ok: true as const, value: events[events.length - 1] };
        },
      } as unknown as DomainEventService,
      intake: {
        ingestion: {
          async ingestProviderPayload(input: {
            payload: NormalizedIngestionPayload;
            replayMode?: string | null;
          }) {
            ingestionCalls.push({
              payload: input.payload,
              replayMode: input.replayMode ?? null,
            });
            return {
              ok: true as const,
              value: {
                intakeEvent: { id: "intake-1" } as unknown as ProviderIngestionResult["intakeEvent"],
                intakeArtifact: { id: "artifact-1" } as unknown as ProviderIngestionResult["intakeArtifact"],
                communicationThread: null,
                communicationMessage: null,
                communicationAttachments: [],
                providerMessageReceipt: {
                  ...seedIngestedReceipt(receipts, "connection-1"),
                  id: "receipt-replayed-1",
                },
                providerThreadMapping: null,
              },
            };
          },
        },
      } as unknown as IntakeDomainServices,
      attachmentSource: {
        async getAttachmentContent() {
          return {
            content: new Uint8Array([1, 2, 3]),
            mimeType: "image/jpeg",
            sizeBytes: 3,
            storagePath: "hydrated/provider/photo.jpg",
            contentHash: "hash-123",
          };
        },
      },
    },
  );

  return {
    providers,
    events,
    connections,
    checkpoints,
    syncRuns,
    receipts,
    mappings,
    attachments,
    messages,
    threads,
    ingestionCalls,
  };
}

function createProviderConnectionRepository(store: ProviderConnection[]): ProviderConnectionRepository {
  return {
    newId: () => `connection-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByOrganizationId(organizationId) {
      const items = store.filter((item) => item.organizationId === organizationId);
      return { items, count: items.length };
    },
    async findByWebhookSubscription(input) {
      return store.find((item) =>
        item.providerKey === input.providerKey &&
        item.metadata.webhookSubscriptionId === input.subscriptionId
      ) ?? null;
    },
    async findByMailboxAddress(input) {
      return store.find((item) =>
        item.organizationId === input.organizationId &&
        item.providerKey === input.providerKey &&
        item.mailboxAddress === input.mailboxAddress
      ) ?? null;
    },
  };
}

function createProviderSyncCheckpointRepository(store: ProviderSyncCheckpoint[]): ProviderSyncCheckpointRepository {
  return {
    newId: () => `checkpoint-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByConnectionId(connectionId) {
      const items = store.filter((item) => item.providerConnectionId === connectionId);
      return { items, count: items.length };
    },
    async findByScope(input) {
      return store.find((item) =>
        item.organizationId === input.organizationId &&
        item.providerConnectionId === input.providerConnectionId &&
        item.checkpointType === input.checkpointType &&
        item.mailboxScope.mailboxAddress === input.mailboxAddress &&
        item.mailboxScope.folderId === input.folderId
      ) ?? null;
    },
  };
}

function createProviderSyncRunRepository(store: ProviderSyncRun[]): ProviderSyncRunRepository {
  return {
    newId: () => `sync-run-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByConnectionId(connectionId) {
      const items = store.filter((item) => item.connectionId === connectionId);
      return { items, count: items.length };
    },
    async listByOrganizationId(organizationId) {
      const items = store.filter((item) => item.organizationId === organizationId);
      return { items, count: items.length };
    },
    async claimRun(input) {
      const current = store.find((item) => item.id === input.syncRunId && item.organizationId === input.organizationId) ?? null;
      if (!current) {
        return null;
      }
      const normalized = ensureProviderClaimState(current);
      if (
        normalized.claim.claimedBy &&
        normalized.claim.leaseExpiresAt &&
        normalized.claim.leaseExpiresAt > input.claimedAt &&
        normalized.claim.releasedAt === null
      ) {
        return null;
      }
      const nextVersion = (normalized.claim.claimVersion ?? 0) + 1;
      const updated: ProviderSyncRun = {
        ...normalized,
        claim: {
          claimedBy: input.claimedBy,
          claimToken: `${normalized.id}:claim:${nextVersion}`,
          claimVersion: nextVersion,
          claimedAt: input.claimedAt,
          leaseExpiresAt: input.leaseExpiresAt,
          heartbeatAt: input.claimedAt,
          releasedAt: null,
          reclaimedAt:
            normalized.claim.claimedBy && normalized.claim.leaseExpiresAt && normalized.claim.leaseExpiresAt <= input.claimedAt
              ? input.claimedAt
              : normalized.claim.reclaimedAt,
          reclaimedBy:
            normalized.claim.claimedBy && normalized.claim.leaseExpiresAt && normalized.claim.leaseExpiresAt <= input.claimedAt
              ? input.claimedBy
              : normalized.claim.reclaimedBy,
          reclaimCount:
            (normalized.claim.reclaimCount ?? 0) +
            (normalized.claim.claimedBy && normalized.claim.leaseExpiresAt && normalized.claim.leaseExpiresAt <= input.claimedAt ? 1 : 0),
        },
        updatedAt: input.claimedAt,
      };
      upsertById(store, updated);
      return updated;
    },
    async mutateWithActiveClaim(input) {
      const current = store.find((item) => item.id === input.syncRunId && item.organizationId === input.organizationId) ?? null;
      if (!current) {
        return null;
      }
      const normalized = ensureProviderClaimState(current);
      if (
        normalized.claim.claimedBy !== input.claimedBy ||
        normalized.claim.claimToken !== input.claimToken ||
        normalized.claim.leaseExpiresAt === null ||
        normalized.claim.leaseExpiresAt <= input.now
      ) {
        return null;
      }
      const updated = ensureProviderClaimState(input.mutate(normalized));
      upsertById(store, updated);
      return updated;
    },
  };
}

function ensureProviderClaimState(run: ProviderSyncRun): ProviderSyncRun {
  return {
    ...run,
    claim: run.claim ?? {
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
  };
}

function createProviderMessageReceiptRepository(store: ProviderMessageReceipt[]): ProviderMessageReceiptRepository {
  return {
    newId: () => `receipt-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async findByFingerprint(organizationId, fingerprint) {
      return store.find((item) => item.organizationId === organizationId && item.fingerprint === fingerprint) ?? null;
    },
    async findByProviderMessage(input) {
      return store.find((item) =>
        item.organizationId === input.organizationId &&
        item.providerKey === input.providerKey &&
        item.providerConnectionId === input.providerConnectionId &&
        (
          (input.providerMessageId && item.providerMessageId === input.providerMessageId) ||
          (input.internetMessageId && item.internetMessageId === input.internetMessageId)
        )
      ) ?? null;
    },
    async listByConnectionId(connectionId) {
      const items = store.filter((item) => item.providerConnectionId === connectionId);
      return { items, count: items.length };
    },
    async listByOrganizationId(organizationId) {
      const items = store.filter((item) => item.organizationId === organizationId);
      return { items, count: items.length };
    },
  };
}

function createProviderThreadMappingRepository(store: ProviderThreadMapping[]): ProviderThreadMappingRepository {
  return {
    newId: () => `mapping-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async findByProviderThread(input) {
      return store.find((item) =>
        item.organizationId === input.organizationId &&
        item.providerKey === input.providerKey &&
        item.providerConnectionId === input.providerConnectionId &&
        item.providerThreadId === input.providerThreadId
      ) ?? null;
    },
    async listByConnectionId(connectionId) {
      const items = store.filter((item) => item.providerConnectionId === connectionId);
      return { items, count: items.length };
    },
  };
}

function createCommunicationAttachmentRepository(store: CommunicationAttachment[]): CommunicationAttachmentRepository {
  return {
    newId: () => `attachment-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByMessageId(messageId) {
      const items = store.filter((item) => item.messageId === messageId);
      return { items, count: items.length };
    },
    async listByWorkOrderId(workOrderId) {
      const items = store.filter((item) => item.workOrderId === workOrderId);
      return { items, count: items.length };
    },
  };
}

function createCommunicationMessageRepository(store: CommunicationMessage[]): CommunicationMessageRepository {
  return {
    newId: () => `message-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByThreadId(threadId) {
      const items = store.filter((item) => item.threadId === threadId);
      return { items, count: items.length };
    },
    async listByWorkOrderId(workOrderId) {
      const items = store.filter((item) => item.workOrderId === workOrderId);
      return { items, count: items.length };
    },
  };
}

function createCommunicationThreadRepository(store: CommunicationThread[]): CommunicationThreadRepository {
  return {
    newId: () => `thread-${store.length + 1}`,
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByWorkOrderId(workOrderId) {
      const items = store.filter((item) => item.workOrderId === workOrderId);
      return { items, count: items.length };
    },
    async findByWorkOrderChannelVisibility() {
      return null;
    },
  };
}

function createEmptyIntakeArtifactRepository(): IntakeArtifactRepository {
  return {
    newId: () => "artifact-1",
    async getById() {
      return null;
    },
    async create(entity) {
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      return { id: entity.id, item: entity };
    },
    async listByIntakeEventId() {
      return { items: [], count: 0 };
    },
  };
}

function seedConnection(store: ProviderConnection[]) {
  const connection: ProviderConnection = {
    id: "connection-1",
    organizationId: "org-1",
    tenantId: "org-1",
    providerKey: "microsoft_graph",
    providerTenantId: "tenant-1",
    providerAccountId: "account-1",
    mailboxAddress: "ops@example.com",
    displayName: "Ops",
    scopes: ["mail.read"],
    scopeMetadata: {},
    status: "active",
    healthStatus: "healthy",
    ownerUserId: "manager-1",
    connectedAt: now(),
    disabledAt: null,
    expiresAt: null,
    lastHealthyAt: now(),
    lastError: null,
    lastSyncedAt: now(),
    metadata: {},
    createdAt: now(),
    updatedAt: now(),
  };
  store.push(connection);
  return connection;
}

function seedFailedReceipt(store: ProviderMessageReceipt[]) {
  const receipt: ProviderMessageReceipt = {
    id: "receipt-failed-1",
    organizationId: "org-1",
    tenantId: "org-1",
    providerKey: "microsoft_graph",
    providerConnectionId: "connection-1",
    providerMessageId: "provider-message-1",
    internetMessageId: "<message-1@example.com>",
    providerThreadId: "thread-1",
    canonicalThreadId: null,
    canonicalMessageId: null,
    intakeEventId: null,
    attachmentIds: [],
    fingerprint: "fp-1",
    status: "failed",
    visibility: ["internal"],
    receivedAt: now(),
    processedAt: now(),
    failureReason: "graph_timeout",
    reviewedAt: null,
    reviewedByUserId: null,
    supersededByReceiptId: null,
    metadata: {
      replayPayload: makeReplayPayload(),
    },
    createdAt: now(),
  };
  store.push(receipt);
  return receipt;
}

function seedIngestedReceipt(store: ProviderMessageReceipt[], connectionId: string) {
  const receipt: ProviderMessageReceipt = {
    id: "receipt-ingested-1",
    organizationId: "org-1",
    tenantId: "org-1",
    providerKey: "microsoft_graph",
    providerConnectionId: connectionId,
    providerMessageId: "provider-message-2",
    internetMessageId: "<message-2@example.com>",
    providerThreadId: "thread-1",
    canonicalThreadId: "thread-canonical-1",
    canonicalMessageId: "message-canonical-1",
    intakeEventId: "intake-1",
    attachmentIds: ["attachment-1"],
    fingerprint: "fp-2",
    status: "ingested",
    visibility: ["internal"],
    receivedAt: now(),
    processedAt: now(),
    failureReason: null,
    reviewedAt: null,
    reviewedByUserId: null,
    supersededByReceiptId: null,
    metadata: {
      replayPayload: makeReplayPayload(),
    },
    createdAt: now(),
  };
  store.push(receipt);
  return receipt;
}

function seedAttachment(store: CommunicationAttachment[], attachmentId: string) {
  const attachment: CommunicationAttachment = {
    id: attachmentId,
    organizationId: "org-1",
    tenantId: "org-1",
    threadId: "thread-canonical-1",
    messageId: "message-canonical-1",
    workOrderId: null,
    fileName: "photo.jpg",
    contentType: "image/jpeg",
    sizeBytes: 1024,
    storagePath: "provider/photo.jpg",
    hydrationStatus: "pending",
    hydratedAt: null,
    hydrationError: null,
    contentHash: null,
    visibility: ["internal"],
    uploadedByActor: {
      actorId: null,
      actorType: "system",
      actorRole: "system",
      displayName: null,
    },
    externalProvider: "microsoft_graph",
    externalAttachmentId: "provider-attachment-1",
    metadata: {},
    createdAt: now(),
  };
  store.push(attachment);
  return attachment;
}

function seedThreadArtifacts(
  threads: CommunicationThread[],
  messages: CommunicationMessage[],
  mappings: ProviderThreadMapping[],
  receipt: ProviderMessageReceipt,
  connectionId: string,
) {
  threads.push({
    id: "thread-canonical-1",
    organizationId: "org-1",
    tenantId: "org-1",
    workOrderId: null,
    channel: "email",
    subject: "Freezer leak",
    visibility: ["internal"],
    participantIds: [],
    relatedEventIds: [],
    linkedEntityIds: ["intake-1"],
    lastMessageId: "message-canonical-1",
    lastMessageAt: now(),
    externalProvider: "microsoft_graph",
    externalThreadId: "thread-1",
    metadata: {},
    createdAt: now(),
    createdByActor: {
      actorId: null,
      actorType: "system",
      actorRole: "system",
      displayName: null,
    },
    updatedAt: now(),
  });
  messages.push({
    id: "message-canonical-1",
    organizationId: "org-1",
    tenantId: "org-1",
    threadId: "thread-canonical-1",
    workOrderId: null,
    referenceMessageId: null,
    channel: "email",
    direction: "inbound",
    visibility: ["internal"],
    subject: "Freezer leak",
    body: "Leaking freezer",
    plainTextBody: "Leaking freezer",
    normalizedContent: "leaking freezer",
    metadata: {},
    senderActorId: null,
    senderActorType: "system",
    senderActorRole: "system",
    participantIds: [],
    clientContactId: null,
    contractorOrganizationId: null,
    linkedEntityIds: ["intake-1"],
    relatedEventIds: [],
    sentAt: now(),
    deliveredAt: null,
    readAt: null,
    externalProvider: "microsoft_graph",
    externalThreadId: "thread-1",
    externalMessageId: receipt.providerMessageId,
    createdAt: now(),
    createdByActor: {
      actorId: null,
      actorType: "system",
      actorRole: "system",
      displayName: null,
    },
  });
  mappings.push({
    id: "mapping-1",
    organizationId: "org-1",
    tenantId: "org-1",
    providerKey: "microsoft_graph",
    providerConnectionId: connectionId,
    providerThreadId: "thread-1",
    canonicalThreadId: "thread-canonical-1",
    latestProviderMessageId: receipt.providerMessageId,
    latestInternetMessageId: receipt.internetMessageId,
    latestCanonicalMessageId: "message-canonical-1",
    messageCount: 1,
    threadFingerprint: "thread-fp",
    metadata: {},
    createdAt: now(),
    updatedAt: now(),
  });
}

function makeReplayPayload(): NormalizedIngestionPayload {
  return {
    organizationId: "org-1",
    sourceType: "email",
    channel: "email",
    receivedAt: now(),
    sentAt: now(),
    summary: "Provider replay payload",
    message: {
      subject: "Freezer leak",
      body: "Leaking freezer",
      plainTextBody: "Leaking freezer",
      normalizedText: "leaking freezer",
      preview: "Leaking freezer",
    },
    sender: {
      displayName: "Store 101",
      email: "store101@example.com",
      phone: null,
      externalParticipantId: "sender-1",
      metadata: {},
    },
    recipients: [],
    attachments: [],
    thread: {
      threadId: "thread-1",
      parentMessageId: null,
      conversationKey: "conv-1",
      messageKey: "provider-message-1",
    },
    provider: {
      providerKey: "microsoft_graph",
      providerType: "email",
      providerConnectionId: "connection-1",
      providerAccountId: "account-1",
      providerTenantId: "tenant-1",
      externalMessageId: "provider-message-1",
      externalInternetMessageId: "<message-1@example.com>",
      externalThreadId: "thread-1",
      externalConversationId: "conv-1",
      metadata: {},
    },
    metadata: {},
  };
}

function mailboxScope() {
  return {
    mailboxAddress: "ops@example.com",
    folderId: "inbox",
    folderName: "Inbox",
    folderPath: "/Inbox",
    metadata: {},
  };
}

function upsertById<T extends { id: string }>(store: T[], entity: T) {
  const index = store.findIndex((item) => item.id === entity.id);
  if (index >= 0) {
    store[index] = entity;
    return;
  }
  store.push(entity);
}

function now() {
  return new Date("2026-05-06T12:00:00.000Z").toISOString();
}
