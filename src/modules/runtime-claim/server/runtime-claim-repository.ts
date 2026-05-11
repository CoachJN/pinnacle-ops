import "server-only";

import type { DocumentData, Firestore } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { FIRESTORE_COLLECTIONS, toFirestoreTimestamp, toIsoDateTime } from "@/server/repositories";
import type { ProviderReceipt } from "@/modules/provider-runtime";
import type { WorkerJob } from "@/modules/runtime";
import type { RuntimeClaimRecoveryEvent, RuntimeWorkerHeartbeat } from "../domain/runtime-worker-heartbeat";
import type { RuntimeClaimWindow } from "../domain/runtime-claim-window";

const RUNTIME_CLAIM_COLLECTIONS = {
  windows: "runtimeClaimWindows",
  workers: "runtimeClaimWorkers",
  recoveryEvents: "runtimeClaimRecoveryEvents",
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
  providerType: ProviderReceipt["providerType"];
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
  normalizedStatus: ProviderReceipt["normalizedStatus"];
  rawStatus: string | null;
  processedAt: string | null;
  reconciliationStatus: ProviderReceipt["reconciliationStatus"];
  reconciliationReason: string | null;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
  isDeleted?: boolean;
};

type RuntimeClaimWindowDocument = Omit<RuntimeClaimWindow, "createdAt" | "updatedAt"> & {
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
};

type RuntimeWorkerHeartbeatDocument = Omit<RuntimeWorkerHeartbeat, "heartbeatAt" | "leaseExpiresAt" | "createdAt" | "updatedAt"> & {
  heartbeatAt: FirebaseFirestore.Timestamp;
  leaseExpiresAt: FirebaseFirestore.Timestamp;
  createdAt: FirebaseFirestore.Timestamp;
  updatedAt: FirebaseFirestore.Timestamp;
};

type RuntimeClaimRecoveryEventDocument = Omit<RuntimeClaimRecoveryEvent, "detectedAt"> & {
  detectedAt: FirebaseFirestore.Timestamp;
};

export interface RuntimeClaimSourceRepository {
  listRuntimeJobs(input?: {
    limit?: number;
    statuses?: readonly WorkerJob["status"][];
  }): Promise<WorkerJob[]>;
  listProviderReceipts(input?: { limit?: number }): Promise<ProviderReceipt[]>;
}

export interface RuntimeClaimWindowRepository {
  newWindowId(): string;
  findByWindowKey(windowKey: string): Promise<RuntimeClaimWindow | null>;
  listRecentWindows(input?: { limit?: number }): Promise<RuntimeClaimWindow[]>;
  saveWindow(window: RuntimeClaimWindow): Promise<RuntimeClaimWindow>;
}

export interface RuntimeClaimWorkerRepository {
  getWorker(workerId: string): Promise<RuntimeWorkerHeartbeat | null>;
  listWorkers(): Promise<RuntimeWorkerHeartbeat[]>;
  saveWorker(worker: RuntimeWorkerHeartbeat): Promise<RuntimeWorkerHeartbeat>;
}

export interface RuntimeClaimRecoveryRepository {
  newRecoveryEventId(): string;
  listRecentEvents(input?: { limit?: number }): Promise<RuntimeClaimRecoveryEvent[]>;
  saveEvent(event: RuntimeClaimRecoveryEvent): Promise<RuntimeClaimRecoveryEvent>;
}

export function createFirestoreRuntimeClaimRepositories(
  firestore: Firestore = getFirebaseAdminFirestore(),
): {
  source: RuntimeClaimSourceRepository;
  windows: RuntimeClaimWindowRepository;
  workers: RuntimeClaimWorkerRepository;
  recovery: RuntimeClaimRecoveryRepository;
} {
  const jobsCollection = firestore.collection(FIRESTORE_COLLECTIONS.runtimeJobs);
  const receiptsCollection = firestore.collection("providerReceipts");
  const windowsCollection = firestore.collection(RUNTIME_CLAIM_COLLECTIONS.windows);
  const workersCollection = firestore.collection(RUNTIME_CLAIM_COLLECTIONS.workers);
  const recoveryCollection = firestore.collection(RUNTIME_CLAIM_COLLECTIONS.recoveryEvents);

  return {
    source: {
      async listRuntimeJobs(input = {}) {
        const statuses = input.statuses ?? ["queued", "leased", "running"];
        let query = jobsCollection.where("isDeleted", "==", false);
        if (statuses.length > 0 && statuses.length <= 10) {
          query = query.where("status", "in", [...statuses]);
        }
        const snapshot = await query.orderBy("updatedAt", "desc").limit(input.limit ?? 2_000).get();
        return snapshot.docs.map((document) => workerJobFromDocument(document.id, document.data() as WorkerJobDocument));
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
    windows: {
      newWindowId() {
        return windowsCollection.doc().id;
      },
      async findByWindowKey(windowKey) {
        const snapshot = await windowsCollection.where("windowKey", "==", windowKey).limit(1).get();
        const document = snapshot.docs[0];
        return document ? runtimeClaimWindowFromDocument(document.id, document.data() as RuntimeClaimWindowDocument) : null;
      },
      async listRecentWindows(input = {}) {
        const snapshot = await windowsCollection.orderBy("updatedAt", "desc").limit(input.limit ?? 50).get();
        return snapshot.docs.map((document) =>
          runtimeClaimWindowFromDocument(document.id, document.data() as RuntimeClaimWindowDocument),
        );
      },
      async saveWindow(window) {
        await windowsCollection.doc(window.id).set(runtimeClaimWindowToDocument(window) as DocumentData, { merge: true });
        return window;
      },
    },
    workers: {
      async getWorker(workerId) {
        const document = await workersCollection.doc(workerId).get();
        return document.exists
          ? runtimeWorkerHeartbeatFromDocument(document.id, document.data() as RuntimeWorkerHeartbeatDocument)
          : null;
      },
      async listWorkers() {
        const snapshot = await workersCollection.orderBy("workerId", "asc").get();
        return snapshot.docs.map((document) =>
          runtimeWorkerHeartbeatFromDocument(document.id, document.data() as RuntimeWorkerHeartbeatDocument),
        );
      },
      async saveWorker(worker) {
        await workersCollection.doc(worker.workerId).set(runtimeWorkerHeartbeatToDocument(worker) as DocumentData, { merge: true });
        return worker;
      },
    },
    recovery: {
      newRecoveryEventId() {
        return recoveryCollection.doc().id;
      },
      async listRecentEvents(input = {}) {
        const snapshot = await recoveryCollection.orderBy("detectedAt", "desc").limit(input.limit ?? 50).get();
        return snapshot.docs.map((document) =>
          runtimeClaimRecoveryEventFromDocument(document.id, document.data() as RuntimeClaimRecoveryEventDocument),
        );
      },
      async saveEvent(event) {
        await recoveryCollection.doc(event.id).set(runtimeClaimRecoveryEventToDocument(event) as DocumentData, { merge: true });
        return event;
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
    runAfter: toIsoDateTime(document.runAfter, "runtimeClaim.runtimeJobs.runAfter"),
    leasedBy: document.leasedBy,
    leaseExpiresAt: document.leaseExpiresAt
      ? toIsoDateTime(document.leaseExpiresAt, "runtimeClaim.runtimeJobs.leaseExpiresAt")
      : null,
    lease: document.lease
      ? {
          workerId: document.lease.workerId ?? document.leasedBy ?? null,
          claimToken: document.lease.claimToken ?? null,
          leaseVersion: document.lease.leaseVersion ?? 0,
          claimedAt: document.lease.claimedAt
            ? toIsoDateTime(document.lease.claimedAt, "runtimeClaim.runtimeJobs.lease.claimedAt")
            : null,
          leaseExpiresAt: document.lease.leaseExpiresAt
            ? toIsoDateTime(
                document.lease.leaseExpiresAt,
                "runtimeClaim.runtimeJobs.lease.leaseExpiresAt",
              )
            : null,
          heartbeatAt: document.lease.heartbeatAt
            ? toIsoDateTime(document.lease.heartbeatAt, "runtimeClaim.runtimeJobs.lease.heartbeatAt")
            : null,
          reclaimedAt: document.lease.reclaimedAt
            ? toIsoDateTime(document.lease.reclaimedAt, "runtimeClaim.runtimeJobs.lease.reclaimedAt")
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
            ? toIsoDateTime(document.leaseExpiresAt, "runtimeClaim.runtimeJobs.leaseExpiresAt")
            : null,
          heartbeatAt: null,
          reclaimedAt: null,
          reclaimedBy: null,
          reclaimCount: 0,
        },
    createdAt: toIsoDateTime(document.createdAt, "runtimeClaim.runtimeJobs.createdAt"),
    updatedAt: toIsoDateTime(document.updatedAt, "runtimeClaim.runtimeJobs.updatedAt"),
    lastError: document.lastError
      ? {
          code: document.lastError.code,
          message: document.lastError.message,
          retryable: document.lastError.retryable,
          occurredAt: toIsoDateTime(document.lastError.occurredAt, "runtimeClaim.runtimeJobs.lastError.occurredAt"),
          details: document.lastError.details,
        }
      : null,
    completedAt: document.completedAt ? toIsoDateTime(document.completedAt, "runtimeClaim.runtimeJobs.completedAt") : null,
  };
}

function providerReceiptFromDocument(id: string, document: ProviderReceiptDocument): ProviderReceipt {
  return {
    id,
    organizationId: document.organizationId,
    tenantId: document.tenantId,
    providerType: document.providerType,
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
    normalizedStatus: document.normalizedStatus,
    rawStatus: document.rawStatus,
    receivedAt: document.receivedAt,
    processedAt: document.processedAt,
    reconciliationStatus: document.reconciliationStatus,
    reconciliationReason: document.reconciliationReason,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    metadata: document.metadata,
  };
}

function runtimeClaimWindowFromDocument(id: string, document: RuntimeClaimWindowDocument): RuntimeClaimWindow {
  return {
    ...document,
    id,
    createdAt: toIsoDateTime(document.createdAt, "runtimeClaimWindows.createdAt"),
    updatedAt: toIsoDateTime(document.updatedAt, "runtimeClaimWindows.updatedAt"),
  };
}

function runtimeClaimWindowToDocument(window: RuntimeClaimWindow): RuntimeClaimWindowDocument {
  return {
    ...window,
    createdAt: toFirestoreTimestamp(window.createdAt),
    updatedAt: toFirestoreTimestamp(window.updatedAt),
  };
}

function runtimeWorkerHeartbeatFromDocument(id: string, document: RuntimeWorkerHeartbeatDocument): RuntimeWorkerHeartbeat {
  return {
    ...document,
    workerId: id,
    heartbeatAt: toIsoDateTime(document.heartbeatAt, "runtimeClaimWorkers.heartbeatAt"),
    leaseExpiresAt: toIsoDateTime(document.leaseExpiresAt, "runtimeClaimWorkers.leaseExpiresAt"),
    createdAt: toIsoDateTime(document.createdAt, "runtimeClaimWorkers.createdAt"),
    updatedAt: toIsoDateTime(document.updatedAt, "runtimeClaimWorkers.updatedAt"),
  };
}

function runtimeWorkerHeartbeatToDocument(worker: RuntimeWorkerHeartbeat): RuntimeWorkerHeartbeatDocument {
  return {
    ...worker,
    heartbeatAt: toFirestoreTimestamp(worker.heartbeatAt),
    leaseExpiresAt: toFirestoreTimestamp(worker.leaseExpiresAt),
    createdAt: toFirestoreTimestamp(worker.createdAt),
    updatedAt: toFirestoreTimestamp(worker.updatedAt),
  };
}

function runtimeClaimRecoveryEventFromDocument(
  id: string,
  document: RuntimeClaimRecoveryEventDocument,
): RuntimeClaimRecoveryEvent {
  return {
    ...document,
    id,
    detectedAt: toIsoDateTime(document.detectedAt, "runtimeClaimRecoveryEvents.detectedAt"),
  };
}

function runtimeClaimRecoveryEventToDocument(
  event: RuntimeClaimRecoveryEvent,
): RuntimeClaimRecoveryEventDocument {
  return {
    ...event,
    detectedAt: toFirestoreTimestamp(event.detectedAt),
  };
}
