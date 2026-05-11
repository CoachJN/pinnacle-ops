import "server-only";

import type { DocumentData, Firestore, Query } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { FIRESTORE_COLLECTIONS, toFirestoreTimestamp, toIsoDateTime } from "@/server/repositories";
import { PROVIDER_RUNTIME_TYPES, type ProviderReceipt } from "@/modules/provider-runtime";
import type { WorkerJob } from "@/modules/runtime";
import type { AllocatorLease } from "../domain/allocator-lease";
import type { RuntimeAllocationRecord } from "../domain/runtime-allocation";

const RUNTIME_ALLOCATOR_COLLECTIONS = {
  leases: "runtimeAllocatorLeases",
  allocations: "runtimeAllocations",
} as const;

type WorkerJobDocument = {
  organizationId: string;
  tenantId: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  payloadVersion: string;
  idempotencyKey: string;
  correlationId: string;
  causationId: string;
  sourceEventId: string | null;
  attemptCount: number;
  maxAttempts: number;
  runAfter: FirebaseFirestore.Timestamp;
  leasedBy: string | null;
  leaseExpiresAt: FirebaseFirestore.Timestamp | null;
  lease?: {
    workerId: string | null;
    claimToken: string | null;
    leaseVersion: number;
    claimedAt: FirebaseFirestore.Timestamp | null;
    leaseExpiresAt: FirebaseFirestore.Timestamp | null;
    heartbeatAt: FirebaseFirestore.Timestamp | null;
    reclaimedAt: FirebaseFirestore.Timestamp | null;
    reclaimedBy: string | null;
    reclaimCount: number;
  };
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
  lastError: {
    code: string | null;
    message: string;
    retryable: boolean;
    occurredAt: FirebaseFirestore.Timestamp;
    details: Record<string, unknown>;
  } | null;
  completedAt: FirebaseFirestore.Timestamp | null;
  isDeleted?: boolean;
};

type ProviderReceiptDocument = {
  organizationId: string;
  tenantId: string;
  providerType: string;
  providerEventType: string;
  providerMessageId: string | null;
  providerCorrelationId: string | null;
  providerReceiptId: string | null;
  deliveryAttemptId: string | null;
  deliveryPlanId: string | null;
  sourceWebhookEventId: string | null;
  correlationId: string;
  causationId: string;
  idempotencyKey: string;
  normalizedStatus: string;
  rawStatus: string | null;
  processedAt: string | null;
  reconciliationStatus: string;
  reconciliationReason: string | null;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
};

type AllocatorLeaseDocument = Omit<AllocatorLease, "leaseExpiresAt" | "lastHeartbeatAt" | "createdAt" | "updatedAt"> & {
  leaseExpiresAt: FirebaseFirestore.Timestamp;
  lastHeartbeatAt: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
};

type RuntimeAllocationDocument = Omit<
  RuntimeAllocationRecord,
  "windowStartedAt" | "windowEndsAt" | "createdAt" | "updatedAt"
> & {
  windowStartedAt: FirebaseFirestore.Timestamp;
  windowEndsAt: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
};

export interface RuntimeAllocatorGlobalRepository {
  listRuntimeJobs(input?: {
    limit?: number;
    statuses?: readonly WorkerJob["status"][];
  }): Promise<WorkerJob[]>;
  listProviderReceipts(input?: { limit?: number }): Promise<ProviderReceipt[]>;
}

export interface RuntimeAllocatorLeaseRepository {
  newLeaseId(): string;
  getLeaseByShardId(shardId: string): Promise<AllocatorLease | null>;
  listLeases(): Promise<AllocatorLease[]>;
  saveLease(lease: AllocatorLease): Promise<AllocatorLease>;
}

export interface RuntimeAllocationRepository {
  newAllocationId(): string;
  findByAllocationKey(allocationKey: string): Promise<RuntimeAllocationRecord | null>;
  listRecentAllocations(input?: { limit?: number }): Promise<RuntimeAllocationRecord[]>;
  saveAllocation(record: RuntimeAllocationRecord): Promise<RuntimeAllocationRecord>;
}

export function createFirestoreRuntimeAllocatorRepositories(
  firestore: Firestore = getFirebaseAdminFirestore(),
): {
  global: RuntimeAllocatorGlobalRepository;
  leases: RuntimeAllocatorLeaseRepository;
  allocations: RuntimeAllocationRepository;
} {
  const jobsCollection = firestore.collection(FIRESTORE_COLLECTIONS.runtimeJobs);
  const receiptsCollection = firestore.collection("providerReceipts");
  const leaseCollection = firestore.collection(RUNTIME_ALLOCATOR_COLLECTIONS.leases);
  const allocationCollection = firestore.collection(RUNTIME_ALLOCATOR_COLLECTIONS.allocations);

  return {
    global: {
      async listRuntimeJobs(input = {}) {
        const statuses = input.statuses ?? ["queued", "leased", "running"];
        let query: Query = jobsCollection.where("isDeleted", "==", false);
        if (statuses.length > 0 && statuses.length <= 10) {
          query = query.where("status", "in", [...statuses]);
        }
        query = query.orderBy("updatedAt", "desc").limit(input.limit ?? 2_000);
        const snapshot = await query.get();
        return snapshot.docs.map((document) =>
          workerJobFromDocument(document.id, document.data() as WorkerJobDocument),
        );
      },
      async listProviderReceipts(input = {}) {
        const snapshot = await receiptsCollection
          .where("isDeleted", "==", false)
          .orderBy("receivedAt", "desc")
          .limit(input.limit ?? 2_000)
          .get();
        return snapshot.docs.map((document) =>
          providerReceiptFromDocument(document.id, document.data() as ProviderReceiptDocument),
        );
      },
    },
    leases: {
      newLeaseId() {
        return leaseCollection.doc().id;
      },
      async getLeaseByShardId(shardId) {
        const snapshot = await leaseCollection.where("shardId", "==", shardId).limit(1).get();
        const document = snapshot.docs[0];
        return document ? allocatorLeaseFromDocument(document.id, document.data() as AllocatorLeaseDocument) : null;
      },
      async listLeases() {
        const snapshot = await leaseCollection.orderBy("shardId", "asc").get();
        return snapshot.docs.map((document) =>
          allocatorLeaseFromDocument(document.id, document.data() as AllocatorLeaseDocument),
        );
      },
      async saveLease(lease) {
        await leaseCollection.doc(lease.id).set(allocatorLeaseToDocument(lease) as DocumentData, { merge: true });
        return lease;
      },
    },
    allocations: {
      newAllocationId() {
        return allocationCollection.doc().id;
      },
      async findByAllocationKey(allocationKey) {
        const snapshot = await allocationCollection.where("allocationKey", "==", allocationKey).limit(1).get();
        const document = snapshot.docs[0];
        return document
          ? runtimeAllocationFromDocument(document.id, document.data() as RuntimeAllocationDocument)
          : null;
      },
      async listRecentAllocations(input = {}) {
        const snapshot = await allocationCollection
          .orderBy("windowStartedAt", "desc")
          .limit(input.limit ?? 25)
          .get();
        return snapshot.docs.map((document) =>
          runtimeAllocationFromDocument(document.id, document.data() as RuntimeAllocationDocument),
        );
      },
      async saveAllocation(record) {
        await allocationCollection
          .doc(record.id)
          .set(runtimeAllocationToDocument(record) as DocumentData, { merge: true });
        return record;
      },
    },
  };
}

function workerJobFromDocument(id: string, document: WorkerJobDocument): WorkerJob {
  return {
    id,
    organizationId: document.organizationId,
    tenantId: document.tenantId,
    type: document.type,
    status: document.status as WorkerJob["status"],
    payload: document.payload,
    payloadVersion: document.payloadVersion,
    idempotencyKey: document.idempotencyKey,
    correlationId: document.correlationId,
    causationId: document.causationId,
    sourceEventId: document.sourceEventId,
    attemptCount: document.attemptCount,
    maxAttempts: document.maxAttempts,
    runAfter: toIsoDateTime(document.runAfter, "runtimeJobs.runAfter"),
    leasedBy: document.leasedBy,
    leaseExpiresAt: document.leaseExpiresAt
      ? toIsoDateTime(document.leaseExpiresAt, "runtimeJobs.leaseExpiresAt")
      : null,
    lease: document.lease
      ? {
          workerId: document.lease.workerId ?? document.leasedBy ?? null,
          claimToken: document.lease.claimToken ?? null,
          leaseVersion: document.lease.leaseVersion ?? 0,
          claimedAt: document.lease.claimedAt
            ? toIsoDateTime(document.lease.claimedAt, "runtimeJobs.lease.claimedAt")
            : null,
          leaseExpiresAt: document.lease.leaseExpiresAt
            ? toIsoDateTime(document.lease.leaseExpiresAt, "runtimeJobs.lease.leaseExpiresAt")
            : null,
          heartbeatAt: document.lease.heartbeatAt
            ? toIsoDateTime(document.lease.heartbeatAt, "runtimeJobs.lease.heartbeatAt")
            : null,
          reclaimedAt: document.lease.reclaimedAt
            ? toIsoDateTime(document.lease.reclaimedAt, "runtimeJobs.lease.reclaimedAt")
            : null,
          reclaimedBy: document.lease.reclaimedBy ?? null,
          reclaimCount: document.lease.reclaimCount ?? 0,
        }
      : {
          workerId: document.leasedBy ?? null,
          claimToken: null,
          leaseVersion: 0,
          claimedAt: null,
          leaseExpiresAt: document.leaseExpiresAt
            ? toIsoDateTime(document.leaseExpiresAt, "runtimeJobs.leaseExpiresAt")
            : null,
          heartbeatAt: null,
          reclaimedAt: null,
          reclaimedBy: null,
          reclaimCount: 0,
        },
    createdAt: toIsoDateTime(document.createdAt, "runtimeJobs.createdAt"),
    updatedAt: toIsoDateTime(document.updatedAt, "runtimeJobs.updatedAt"),
    lastError: document.lastError
      ? {
          code: document.lastError.code,
          message: document.lastError.message,
          retryable: document.lastError.retryable,
          occurredAt: toIsoDateTime(document.lastError.occurredAt, "runtimeJobs.lastError.occurredAt"),
          details: document.lastError.details,
        }
      : null,
    completedAt: document.completedAt ? toIsoDateTime(document.completedAt, "runtimeJobs.completedAt") : null,
  };
}

function providerReceiptFromDocument(id: string, document: ProviderReceiptDocument): ProviderReceipt {
  return {
    id,
    organizationId: document.organizationId,
    tenantId: document.tenantId,
    providerType:
      document.providerType === PROVIDER_RUNTIME_TYPES.MicrosoftGraphEmail
        ? PROVIDER_RUNTIME_TYPES.MicrosoftGraphEmail
        : PROVIDER_RUNTIME_TYPES.MicrosoftGraphEmail,
    providerEventType: document.providerEventType,
    providerMessageId: document.providerMessageId,
    providerCorrelationId: document.providerCorrelationId,
    providerReceiptId: document.providerReceiptId,
    deliveryAttemptId: document.deliveryAttemptId,
    deliveryPlanId: document.deliveryPlanId,
    sourceWebhookEventId: document.sourceWebhookEventId,
    correlationId: document.correlationId,
    causationId: document.causationId,
    idempotencyKey: document.idempotencyKey,
    normalizedStatus: document.normalizedStatus as ProviderReceipt["normalizedStatus"],
    rawStatus: document.rawStatus,
    receivedAt: document.receivedAt,
    processedAt: document.processedAt,
    reconciliationStatus: document.reconciliationStatus as ProviderReceipt["reconciliationStatus"],
    reconciliationReason: document.reconciliationReason,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    metadata: document.metadata,
  };
}

function allocatorLeaseFromDocument(id: string, document: AllocatorLeaseDocument): AllocatorLease {
  return {
    ...document,
    id,
    leaseExpiresAt: toIsoDateTime(document.leaseExpiresAt, "runtimeAllocatorLeases.leaseExpiresAt"),
    lastHeartbeatAt: toIsoDateTime(document.lastHeartbeatAt, "runtimeAllocatorLeases.lastHeartbeatAt"),
    createdAt: toIsoDateTime(document.createdAt, "runtimeAllocatorLeases.createdAt"),
    updatedAt: toIsoDateTime(document.updatedAt, "runtimeAllocatorLeases.updatedAt"),
  };
}

function allocatorLeaseToDocument(lease: AllocatorLease): AllocatorLeaseDocument {
  return {
    ...lease,
    leaseExpiresAt: toFirestoreTimestamp(lease.leaseExpiresAt),
    lastHeartbeatAt: toFirestoreTimestamp(lease.lastHeartbeatAt),
    createdAt: toFirestoreTimestamp(lease.createdAt),
    updatedAt: toFirestoreTimestamp(lease.updatedAt),
  };
}

function runtimeAllocationFromDocument(id: string, document: RuntimeAllocationDocument): RuntimeAllocationRecord {
  return {
    ...document,
    id,
    windowStartedAt: toIsoDateTime(document.windowStartedAt, "runtimeAllocations.windowStartedAt"),
    windowEndsAt: toIsoDateTime(document.windowEndsAt, "runtimeAllocations.windowEndsAt"),
    createdAt: toIsoDateTime(document.createdAt, "runtimeAllocations.createdAt"),
    updatedAt: toIsoDateTime(document.updatedAt, "runtimeAllocations.updatedAt"),
  };
}

function runtimeAllocationToDocument(record: RuntimeAllocationRecord): RuntimeAllocationDocument {
  return {
    ...record,
    windowStartedAt: toFirestoreTimestamp(record.windowStartedAt),
    windowEndsAt: toFirestoreTimestamp(record.windowEndsAt),
    createdAt: toFirestoreTimestamp(record.createdAt),
    updatedAt: toFirestoreTimestamp(record.updatedAt),
  };
}
