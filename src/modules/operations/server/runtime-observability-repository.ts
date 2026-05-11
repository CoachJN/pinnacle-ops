import "server-only";

import type { Query, Timestamp } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/server/firebase";
import { toFirestoreTimestamp, toIsoDateTime, toNullableFirestoreTimestamp, toNullableIsoDateTime } from "@/server/repositories/firestore";
import type { EntityId } from "@/types/entity";
import type { RuntimeAlert } from "../domain/runtime-alert";
import type { RuntimeProjection } from "../domain/runtime-projection";
import type { RuntimeRepairAction } from "../domain/runtime-repair-action";

const OPERATIONS_COLLECTIONS = {
  runtimeProjections: "operationsRuntimeProjections",
  runtimeAlerts: "operationsRuntimeAlerts",
  runtimeRepairActions: "operationsRuntimeRepairActions",
} as const;

interface RuntimeProjectionDocument {
  organizationId: EntityId;
  tenantId: EntityId;
  healthStatus: RuntimeProjection["healthStatus"];
  generatedAt: Timestamp;
  latestObservedUpdateAt: Timestamp | null;
  projectionLagMs: number;
  queue: Omit<RuntimeProjection["queue"], "oldestQueuedAt"> & {
    oldestQueuedAt: Timestamp | null;
  };
  replay: RuntimeProjection["replay"];
  provider: RuntimeProjection["provider"];
  stuck: RuntimeProjection["stuck"];
  totals: RuntimeProjection["totals"];
  tenantSummary: RuntimeProjection["tenantSummary"];
  trends: RuntimeProjection["trends"];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface RuntimeAlertDocument {
  organizationId: EntityId;
  tenantId: EntityId;
  dedupKey: string;
  alertType: RuntimeAlert["alertType"];
  severity: RuntimeAlert["severity"];
  status: RuntimeAlert["status"];
  summary: string;
  metricValue: number;
  threshold: number;
  correlationId: string;
  causationId: string;
  sourceEventId: EntityId | null;
  metadata: Record<string, unknown>;
  firstDetectedAt: Timestamp;
  lastDetectedAt: Timestamp;
  resolvedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface RuntimeRepairActionDocument {
  organizationId: EntityId;
  tenantId: EntityId;
  actionType: RuntimeRepairAction["actionType"];
  status: RuntimeRepairAction["status"];
  targetType: RuntimeRepairAction["targetType"];
  targetId: EntityId;
  idempotencyKey: string;
  correlationId: string;
  causationId: string;
  sourceEventId: EntityId | null;
  requestedByUserId: EntityId;
  requestedByRole: RuntimeRepairAction["requestedByRole"];
  summary: string;
  metadata: Record<string, unknown>;
  result: Record<string, unknown>;
  requestedAt: Timestamp;
  completedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface RuntimeProjectionRepository {
  getByOrganizationId(organizationId: EntityId): Promise<RuntimeProjection | null>;
  save(projection: RuntimeProjection): Promise<RuntimeProjection>;
}

export interface RuntimeAlertRepository {
  newId(): EntityId;
  create(alert: RuntimeAlert): Promise<RuntimeAlert>;
  save(alert: RuntimeAlert): Promise<RuntimeAlert>;
  findByDedupKey(input: {
    organizationId: EntityId;
    dedupKey: string;
  }): Promise<RuntimeAlert | null>;
  listByOrganizationId(input: {
    organizationId: EntityId;
    status?: RuntimeAlert["status"];
    limit?: number;
  }): Promise<readonly RuntimeAlert[]>;
}

export interface RuntimeRepairActionRepository {
  newId(): EntityId;
  getById(id: EntityId): Promise<RuntimeRepairAction | null>;
  create(action: RuntimeRepairAction): Promise<RuntimeRepairAction>;
  save(action: RuntimeRepairAction): Promise<RuntimeRepairAction>;
  findByIdempotencyKey(input: {
    organizationId: EntityId;
    idempotencyKey: string;
  }): Promise<RuntimeRepairAction | null>;
  listByOrganizationId(input: {
    organizationId: EntityId;
    limit?: number;
  }): Promise<readonly RuntimeRepairAction[]>;
}

export interface RuntimeObservabilityRepositories {
  projections: RuntimeProjectionRepository;
  alerts: RuntimeAlertRepository;
  repairActions: RuntimeRepairActionRepository;
}

export function createFirestoreRuntimeObservabilityRepositories(): RuntimeObservabilityRepositories {
  const firestore = getFirebaseAdminFirestore();
  return {
    projections: new FirestoreRuntimeProjectionRepository(firestore),
    alerts: new FirestoreRuntimeAlertRepository(firestore),
    repairActions: new FirestoreRuntimeRepairActionRepository(firestore),
  };
}

export function createInMemoryRuntimeObservabilityRepositories(seed?: {
  projections?: RuntimeProjection[];
  alerts?: RuntimeAlert[];
  repairActions?: RuntimeRepairAction[];
}): RuntimeObservabilityRepositories {
  const projections = [...(seed?.projections ?? [])];
  const alerts = [...(seed?.alerts ?? [])];
  const repairActions = [...(seed?.repairActions ?? [])];

  return {
    projections: {
      async getByOrganizationId(organizationId) {
        return projections.find((item) => item.organizationId === organizationId) ?? null;
      },
      async save(projection) {
        upsertById(projections, projection);
        return projection;
      },
    },
    alerts: {
      newId() {
        return `ops-alert-${alerts.length + 1}`;
      },
      async create(alert) {
        alerts.push(alert);
        return alert;
      },
      async save(alert) {
        upsertById(alerts, alert);
        return alert;
      },
      async findByDedupKey(input) {
        return (
          alerts.find(
            (item) =>
              item.organizationId === input.organizationId && item.dedupKey === input.dedupKey,
          ) ?? null
        );
      },
      async listByOrganizationId(input) {
        return alerts
          .filter((item) => item.organizationId === input.organizationId)
          .filter((item) => (input.status ? item.status === input.status : true))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
          .slice(0, input.limit ?? alerts.length);
      },
    },
    repairActions: {
      newId() {
        return `ops-repair-${repairActions.length + 1}`;
      },
      async getById(id) {
        return repairActions.find((item) => item.id === id) ?? null;
      },
      async create(action) {
        repairActions.push(action);
        return action;
      },
      async save(action) {
        upsertById(repairActions, action);
        return action;
      },
      async findByIdempotencyKey(input) {
        return (
          repairActions.find(
            (item) =>
              item.organizationId === input.organizationId &&
              item.idempotencyKey === input.idempotencyKey,
          ) ?? null
        );
      },
      async listByOrganizationId(input) {
        return repairActions
          .filter((item) => item.organizationId === input.organizationId)
          .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))
          .slice(0, input.limit ?? repairActions.length);
      },
    },
  };
}

class FirestoreRuntimeProjectionRepository implements RuntimeProjectionRepository {
  private readonly collection = getFirebaseAdminFirestore().collection(
    OPERATIONS_COLLECTIONS.runtimeProjections,
  );

  constructor(private readonly firestore: ReturnType<typeof getFirebaseAdminFirestore>) {}

  async getByOrganizationId(organizationId: EntityId): Promise<RuntimeProjection | null> {
    const snapshot = await this.collection.doc(buildProjectionId(organizationId)).get();
    if (!snapshot.exists) {
      return null;
    }
    return runtimeProjectionFromDocument(snapshot.id, snapshot.data() as RuntimeProjectionDocument);
  }

  async save(projection: RuntimeProjection): Promise<RuntimeProjection> {
    await this.collection.doc(projection.id).set(runtimeProjectionToDocument(projection));
    return projection;
  }
}

class FirestoreRuntimeAlertRepository implements RuntimeAlertRepository {
  private readonly collection = getFirebaseAdminFirestore().collection(
    OPERATIONS_COLLECTIONS.runtimeAlerts,
  );

  constructor(private readonly firestore: ReturnType<typeof getFirebaseAdminFirestore>) {}

  newId(): EntityId {
    return this.collection.doc().id;
  }

  async create(alert: RuntimeAlert): Promise<RuntimeAlert> {
    await this.collection.doc(alert.id).create(runtimeAlertToDocument(alert));
    return alert;
  }

  async save(alert: RuntimeAlert): Promise<RuntimeAlert> {
    await this.collection.doc(alert.id).set(runtimeAlertToDocument(alert), { merge: true });
    return alert;
  }

  async findByDedupKey(input: {
    organizationId: EntityId;
    dedupKey: string;
  }): Promise<RuntimeAlert | null> {
    const snapshot = await this.collection
      .where("organizationId", "==", input.organizationId)
      .where("dedupKey", "==", input.dedupKey)
      .limit(1)
      .get();
    const document = snapshot.docs[0];
    return document
      ? runtimeAlertFromDocument(document.id, document.data() as RuntimeAlertDocument)
      : null;
  }

  async listByOrganizationId(input: {
    organizationId: EntityId;
    status?: RuntimeAlert["status"];
    limit?: number;
  }): Promise<readonly RuntimeAlert[]> {
    let query: Query = this.collection.where("organizationId", "==", input.organizationId);
    if (input.status) {
      query = query.where("status", "==", input.status);
    }
    const snapshot = await query.orderBy("updatedAt", "desc").limit(input.limit ?? 100).get();
    return snapshot.docs.map((document) =>
      runtimeAlertFromDocument(document.id, document.data() as RuntimeAlertDocument),
    );
  }
}

class FirestoreRuntimeRepairActionRepository implements RuntimeRepairActionRepository {
  private readonly collection = getFirebaseAdminFirestore().collection(
    OPERATIONS_COLLECTIONS.runtimeRepairActions,
  );

  constructor(private readonly firestore: ReturnType<typeof getFirebaseAdminFirestore>) {}

  newId(): EntityId {
    return this.collection.doc().id;
  }

  async getById(id: EntityId): Promise<RuntimeRepairAction | null> {
    const snapshot = await this.collection.doc(id).get();
    return snapshot.exists
      ? runtimeRepairActionFromDocument(snapshot.id, snapshot.data() as RuntimeRepairActionDocument)
      : null;
  }

  async create(action: RuntimeRepairAction): Promise<RuntimeRepairAction> {
    await this.collection.doc(action.id).create(runtimeRepairActionToDocument(action));
    return action;
  }

  async save(action: RuntimeRepairAction): Promise<RuntimeRepairAction> {
    await this.collection.doc(action.id).set(runtimeRepairActionToDocument(action), {
      merge: true,
    });
    return action;
  }

  async findByIdempotencyKey(input: {
    organizationId: EntityId;
    idempotencyKey: string;
  }): Promise<RuntimeRepairAction | null> {
    const snapshot = await this.collection
      .where("organizationId", "==", input.organizationId)
      .where("idempotencyKey", "==", input.idempotencyKey)
      .limit(1)
      .get();
    const document = snapshot.docs[0];
    return document
      ? runtimeRepairActionFromDocument(
          document.id,
          document.data() as RuntimeRepairActionDocument,
        )
      : null;
  }

  async listByOrganizationId(input: {
    organizationId: EntityId;
    limit?: number;
  }): Promise<readonly RuntimeRepairAction[]> {
    const snapshot = await this.collection
      .where("organizationId", "==", input.organizationId)
      .orderBy("requestedAt", "desc")
      .limit(input.limit ?? 100)
      .get();
    return snapshot.docs.map((document) =>
      runtimeRepairActionFromDocument(
        document.id,
        document.data() as RuntimeRepairActionDocument,
      ),
    );
  }
}

export function buildProjectionId(organizationId: EntityId): EntityId {
  return `runtime-projection:${organizationId}`;
}

function runtimeProjectionFromDocument(
  id: string,
  document: RuntimeProjectionDocument,
): RuntimeProjection {
  return {
    id,
    organizationId: document.organizationId,
    tenantId: document.tenantId,
    healthStatus: document.healthStatus,
    generatedAt: toIsoDateTime(document.generatedAt, "generatedAt"),
    latestObservedUpdateAt: toNullableIsoDateTime(
      document.latestObservedUpdateAt,
      "latestObservedUpdateAt",
    ),
    projectionLagMs: document.projectionLagMs ?? 0,
    queue: {
      ...document.queue,
      oldestQueuedAt: toNullableIsoDateTime(document.queue.oldestQueuedAt, "oldestQueuedAt"),
    },
    replay: document.replay,
    provider: document.provider,
    stuck: document.stuck,
    totals: document.totals,
    tenantSummary: document.tenantSummary,
    trends: document.trends,
    createdAt: toIsoDateTime(document.createdAt, "createdAt"),
    updatedAt: toIsoDateTime(document.updatedAt, "updatedAt"),
  };
}

function runtimeProjectionToDocument(
  projection: RuntimeProjection,
): RuntimeProjectionDocument {
  const queue = projection.queue;
  return {
    organizationId: projection.organizationId,
    tenantId: projection.tenantId,
    healthStatus: projection.healthStatus,
    generatedAt: toFirestoreTimestamp(projection.generatedAt),
    latestObservedUpdateAt: toNullableFirestoreTimestamp(projection.latestObservedUpdateAt),
    projectionLagMs: projection.projectionLagMs,
    queue: {
      totalJobCount: queue.totalJobCount,
      queuedCount: queue.queuedCount,
      leasedCount: queue.leasedCount,
      runningCount: queue.runningCount,
      failedCount: queue.failedCount,
      deadLetteredCount: queue.deadLetteredCount,
      overdueQueuedCount: queue.overdueQueuedCount,
      expiredLeaseCount: queue.expiredLeaseCount,
      retryStormCount: queue.retryStormCount,
      oldestQueuedAt: toNullableFirestoreTimestamp(queue.oldestQueuedAt),
      queueLagMs: queue.queueLagMs,
    },
    replay: projection.replay,
    provider: projection.provider,
    stuck: projection.stuck,
    totals: projection.totals,
    tenantSummary: projection.tenantSummary,
    trends: projection.trends,
    createdAt: toFirestoreTimestamp(projection.createdAt),
    updatedAt: toFirestoreTimestamp(projection.updatedAt),
  };
}

function runtimeAlertFromDocument(id: string, document: RuntimeAlertDocument): RuntimeAlert {
  return {
    id,
    organizationId: document.organizationId,
    tenantId: document.tenantId,
    dedupKey: document.dedupKey,
    alertType: document.alertType,
    severity: document.severity,
    status: document.status,
    summary: document.summary,
    metricValue: document.metricValue,
    threshold: document.threshold,
    correlationId: document.correlationId,
    causationId: document.causationId,
    sourceEventId: document.sourceEventId ?? null,
    metadata: document.metadata ?? {},
    firstDetectedAt: toIsoDateTime(document.firstDetectedAt, "firstDetectedAt"),
    lastDetectedAt: toIsoDateTime(document.lastDetectedAt, "lastDetectedAt"),
    resolvedAt: toNullableIsoDateTime(document.resolvedAt, "resolvedAt"),
    createdAt: toIsoDateTime(document.createdAt, "createdAt"),
    updatedAt: toIsoDateTime(document.updatedAt, "updatedAt"),
  };
}

function runtimeAlertToDocument(alert: RuntimeAlert): RuntimeAlertDocument {
  return {
    organizationId: alert.organizationId,
    tenantId: alert.tenantId,
    dedupKey: alert.dedupKey,
    alertType: alert.alertType,
    severity: alert.severity,
    status: alert.status,
    summary: alert.summary,
    metricValue: alert.metricValue,
    threshold: alert.threshold,
    correlationId: alert.correlationId,
    causationId: alert.causationId,
    sourceEventId: alert.sourceEventId ?? null,
    metadata: alert.metadata,
    firstDetectedAt: toFirestoreTimestamp(alert.firstDetectedAt),
    lastDetectedAt: toFirestoreTimestamp(alert.lastDetectedAt),
    resolvedAt: toNullableFirestoreTimestamp(alert.resolvedAt),
    createdAt: toFirestoreTimestamp(alert.createdAt),
    updatedAt: toFirestoreTimestamp(alert.updatedAt),
  };
}

function runtimeRepairActionFromDocument(
  id: string,
  document: RuntimeRepairActionDocument,
): RuntimeRepairAction {
  return {
    id,
    organizationId: document.organizationId,
    tenantId: document.tenantId,
    actionType: document.actionType,
    status: document.status,
    targetType: document.targetType,
    targetId: document.targetId,
    idempotencyKey: document.idempotencyKey,
    correlationId: document.correlationId,
    causationId: document.causationId,
    sourceEventId: document.sourceEventId ?? null,
    requestedByUserId: document.requestedByUserId,
    requestedByRole: document.requestedByRole,
    summary: document.summary,
    metadata: document.metadata ?? {},
    result: document.result ?? {},
    requestedAt: toIsoDateTime(document.requestedAt, "requestedAt"),
    completedAt: toNullableIsoDateTime(document.completedAt, "completedAt"),
    createdAt: toIsoDateTime(document.createdAt, "createdAt"),
    updatedAt: toIsoDateTime(document.updatedAt, "updatedAt"),
  };
}

function runtimeRepairActionToDocument(
  action: RuntimeRepairAction,
): RuntimeRepairActionDocument {
  return {
    organizationId: action.organizationId,
    tenantId: action.tenantId,
    actionType: action.actionType,
    status: action.status,
    targetType: action.targetType,
    targetId: action.targetId,
    idempotencyKey: action.idempotencyKey,
    correlationId: action.correlationId,
    causationId: action.causationId,
    sourceEventId: action.sourceEventId ?? null,
    requestedByUserId: action.requestedByUserId,
    requestedByRole: action.requestedByRole,
    summary: action.summary,
    metadata: action.metadata,
    result: action.result,
    requestedAt: toFirestoreTimestamp(action.requestedAt),
    completedAt: toNullableFirestoreTimestamp(action.completedAt),
    createdAt: toFirestoreTimestamp(action.createdAt),
    updatedAt: toFirestoreTimestamp(action.updatedAt),
  };
}

function upsertById<T extends { id: string }>(store: T[], entity: T): void {
  const index = store.findIndex((item) => item.id === entity.id);
  if (index >= 0) {
    store.splice(index, 1, entity);
    return;
  }
  store.push(entity);
}
