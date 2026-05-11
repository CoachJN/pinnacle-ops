import "server-only";

import type { DocumentData, Firestore, Transaction } from "firebase-admin/firestore";
import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import type {
  ActivityLog,
  AiIntakeDraft,
  Assignment,
  ClientInvoice,
  ClientQuote,
  CommunicationAttachment,
  CommunicationLink,
  CommunicationMessage,
  CommunicationParticipant,
  CommunicationThread,
  ContractorQuote,
  DomainEvent,
  IntakeApproval,
  IntakeArtifact,
  IntakeDecision,
  IntakeEvent,
  ProviderMessageReceipt,
  ProviderThreadMapping,
  TransitionAudit,
  TransitionEvent,
  WorkOrder,
  WorkerJob,
} from "@/server/repositories";
import {
  FIRESTORE_COLLECTIONS,
} from "@/server/repositories";
import {
  activityLogMapper,
  aiIntakeDraftMapper,
  assignmentMapper,
  clientInvoiceMapper,
  clientQuoteMapper,
  communicationAttachmentMapper,
  communicationLinkMapper,
  communicationMessageMapper,
  communicationParticipantMapper,
  communicationThreadMapper,
  contractorQuoteMapper,
  domainEventMapper,
  intakeApprovalMapper,
  intakeArtifactMapper,
  intakeDecisionMapper,
  intakeEventMapper,
  providerMessageReceiptMapper,
  providerThreadMappingMapper,
  transitionAuditMapper,
  transitionEventMapper,
  workOrderMapper,
  workerJobMapper,
} from "@/server/repositories/firestore";
import type { EventActor, EventEntityReference } from "@/server/events/types";
import type { EntityId, IsoDateTimeString } from "@/types/entity";

export type AtomicCollectionName =
  | "activityLogs"
  | "aiIntakeDrafts"
  | "assignments"
  | "clientInvoices"
  | "clientQuotes"
  | "communicationAttachments"
  | "communicationLinks"
  | "communicationMessages"
  | "communicationParticipants"
  | "communicationThreads"
  | "contractorQuotes"
  | "domainEvents"
  | "durableOutbox"
  | "intakeApprovals"
  | "intakeArtifacts"
  | "intakeDecisions"
  | "intakeEvents"
  | "providerMessageReceipts"
  | "providerThreadMappings"
  | "transitionAudits"
  | "transitionEvents"
  | "workOrders"
  | "runtimeJobs";

export interface DurableOutboxRecord {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  topic: "domain_event_dispatch";
  status: "pending" | "processed" | "failed";
  entity: EventEntityReference;
  workOrderId: EntityId | null;
  sourceEventId: EntityId;
  correlationId: string;
  causationId: string;
  idempotencyKey: string;
  actor: EventActor;
  payload: {
    eventId: EntityId;
    eventType: DomainEvent["type"];
  };
  availableAt: IsoDateTimeString;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  processedAt: IsoDateTimeString | null;
  failureCount: number;
  lastError: {
    code: string | null;
    message: string;
    occurredAt: IsoDateTimeString;
  } | null;
}

export interface DurableOutboxListOptions {
  organizationId?: EntityId;
  status?: DurableOutboxRecord["status"];
  topic?: DurableOutboxRecord["topic"];
  limit?: number;
}

export interface DurableOutboxService {
  getById(id: EntityId): Promise<DurableOutboxRecord | null>;
  list(input?: DurableOutboxListOptions): Promise<readonly DurableOutboxRecord[]>;
  save(record: DurableOutboxRecord): Promise<void>;
}

type PersistableEntityByCollection = {
  activityLogs: ActivityLog;
  aiIntakeDrafts: AiIntakeDraft;
  assignments: Assignment;
  clientInvoices: ClientInvoice;
  clientQuotes: ClientQuote;
  communicationAttachments: CommunicationAttachment;
  communicationLinks: CommunicationLink;
  communicationMessages: CommunicationMessage;
  communicationParticipants: CommunicationParticipant;
  communicationThreads: CommunicationThread;
  contractorQuotes: ContractorQuote;
  domainEvents: DomainEvent;
  durableOutbox: DurableOutboxRecord;
  intakeApprovals: IntakeApproval;
  intakeArtifacts: IntakeArtifact;
  intakeDecisions: IntakeDecision;
  intakeEvents: IntakeEvent;
  providerMessageReceipts: ProviderMessageReceipt;
  providerThreadMappings: ProviderThreadMapping;
  transitionAudits: TransitionAudit;
  transitionEvents: TransitionEvent;
  workOrders: WorkOrder;
  runtimeJobs: WorkerJob;
};

type AtomicWriteOperation =
  | {
      action: "create";
      collection: AtomicCollectionName;
      id: EntityId;
      data: DocumentData;
    }
  | {
      action: "set";
      collection: AtomicCollectionName;
      id: EntityId;
      data: DocumentData;
      merge: boolean;
    };

export interface AtomicPersistenceContext {
  create<TCollection extends AtomicCollectionName>(
    collection: TCollection,
    entity: PersistableEntityByCollection[TCollection],
  ): void;
  save<TCollection extends Exclude<AtomicCollectionName, "durableOutbox">>(
    collection: TCollection,
    entity: PersistableEntityByCollection[TCollection],
  ): void;
  createRaw(input: AtomicWriteOperation): void;
}

export interface AtomicPersistenceService {
  runInTransaction<T>(
    callback: (context: AtomicPersistenceContext) => Promise<T>,
  ): Promise<T>;
  createDurableOutboxService(): DurableOutboxService;
}

const DURABLE_OUTBOX_COLLECTION = "durableOutbox";

const collectionConfig: Record<
  AtomicCollectionName,
  {
    name: string;
    toDocument: (entity: any) => DocumentData;
  }
> = {
  activityLogs: {
    name: FIRESTORE_COLLECTIONS.activityLogs,
    toDocument: (entity: ActivityLog) => activityLogMapper.toDocument(entity) as DocumentData,
  },
  aiIntakeDrafts: {
    name: FIRESTORE_COLLECTIONS.aiIntakeDrafts,
    toDocument: (entity: AiIntakeDraft) => aiIntakeDraftMapper.toDocument(entity) as DocumentData,
  },
  assignments: {
    name: FIRESTORE_COLLECTIONS.assignments,
    toDocument: (entity: Assignment) => assignmentMapper.toDocument(entity) as DocumentData,
  },
  clientInvoices: {
    name: FIRESTORE_COLLECTIONS.invoices,
    toDocument: (entity: ClientInvoice) => clientInvoiceMapper.toDocument(entity) as DocumentData,
  },
  clientQuotes: {
    name: FIRESTORE_COLLECTIONS.clientQuotes,
    toDocument: (entity: ClientQuote) => clientQuoteMapper.toDocument(entity) as DocumentData,
  },
  communicationAttachments: {
    name: FIRESTORE_COLLECTIONS.communicationAttachments,
    toDocument: (entity: CommunicationAttachment) =>
      communicationAttachmentMapper.toDocument(entity) as DocumentData,
  },
  communicationLinks: {
    name: FIRESTORE_COLLECTIONS.communicationLinks,
    toDocument: (entity: CommunicationLink) => communicationLinkMapper.toDocument(entity) as DocumentData,
  },
  communicationMessages: {
    name: FIRESTORE_COLLECTIONS.communicationMessages,
    toDocument: (entity: CommunicationMessage) =>
      communicationMessageMapper.toDocument(entity) as DocumentData,
  },
  communicationParticipants: {
    name: FIRESTORE_COLLECTIONS.communicationParticipants,
    toDocument: (entity: CommunicationParticipant) =>
      communicationParticipantMapper.toDocument(entity) as DocumentData,
  },
  communicationThreads: {
    name: FIRESTORE_COLLECTIONS.communicationThreads,
    toDocument: (entity: CommunicationThread) =>
      communicationThreadMapper.toDocument(entity) as DocumentData,
  },
  contractorQuotes: {
    name: FIRESTORE_COLLECTIONS.contractorQuotes,
    toDocument: (entity: ContractorQuote) => contractorQuoteMapper.toDocument(entity) as DocumentData,
  },
  domainEvents: {
    name: FIRESTORE_COLLECTIONS.domainEvents,
    toDocument: (entity: DomainEvent) => domainEventMapper.toDocument(entity) as DocumentData,
  },
  durableOutbox: {
    name: DURABLE_OUTBOX_COLLECTION,
    toDocument: (entity: DurableOutboxRecord) => durableOutboxToDocument(entity),
  },
  intakeApprovals: {
    name: FIRESTORE_COLLECTIONS.intakeApprovals,
    toDocument: (entity: IntakeApproval) => intakeApprovalMapper.toDocument(entity) as DocumentData,
  },
  intakeArtifacts: {
    name: FIRESTORE_COLLECTIONS.intakeArtifacts,
    toDocument: (entity: IntakeArtifact) => intakeArtifactMapper.toDocument(entity) as DocumentData,
  },
  intakeDecisions: {
    name: FIRESTORE_COLLECTIONS.intakeDecisions,
    toDocument: (entity: IntakeDecision) => intakeDecisionMapper.toDocument(entity) as DocumentData,
  },
  intakeEvents: {
    name: FIRESTORE_COLLECTIONS.intakeEvents,
    toDocument: (entity: IntakeEvent) => intakeEventMapper.toDocument(entity) as DocumentData,
  },
  providerMessageReceipts: {
    name: FIRESTORE_COLLECTIONS.providerMessageReceipts,
    toDocument: (entity: ProviderMessageReceipt) =>
      providerMessageReceiptMapper.toDocument(entity) as DocumentData,
  },
  providerThreadMappings: {
    name: FIRESTORE_COLLECTIONS.providerThreadMappings,
    toDocument: (entity: ProviderThreadMapping) =>
      providerThreadMappingMapper.toDocument(entity) as DocumentData,
  },
  transitionAudits: {
    name: FIRESTORE_COLLECTIONS.transitionAudits,
    toDocument: (entity: TransitionAudit) => transitionAuditMapper.toDocument(entity) as DocumentData,
  },
  transitionEvents: {
    name: FIRESTORE_COLLECTIONS.transitionEvents,
    toDocument: (entity: TransitionEvent) => transitionEventMapper.toDocument(entity) as DocumentData,
  },
  workOrders: {
    name: FIRESTORE_COLLECTIONS.workOrders,
    toDocument: (entity: WorkOrder) => workOrderMapper.toDocument(entity) as DocumentData,
  },
  runtimeJobs: {
    name: FIRESTORE_COLLECTIONS.runtimeJobs,
    toDocument: (entity: WorkerJob) => workerJobMapper.toDocument(entity) as DocumentData,
  },
};

export function createAtomicPersistenceService(
  firestore: Firestore = getFirebaseAdminFirestore(),
): AtomicPersistenceService {
  return {
    async runInTransaction(callback) {
      return firestore.runTransaction(async (transaction) => {
        const context = new FirestoreAtomicPersistenceContext(firestore, transaction);
        const result = await callback(context);
        context.flush();
        return result;
      });
    },
    createDurableOutboxService() {
      return createFirestoreDurableOutboxService(firestore);
    },
  };
}

export function buildDurableOutboxRecord(input: {
  organizationId: EntityId;
  workOrderId: EntityId | null;
  sourceEventId: EntityId;
  correlationId: string;
  causationId: string;
  actor: EventActor;
  entity: EventEntityReference;
  eventType: DomainEvent["type"];
  now: IsoDateTimeString;
}): DurableOutboxRecord {
  const idempotencyKey = `outbox:domain_event_dispatch:${input.sourceEventId}`;
  return {
    id: `outbox:${input.sourceEventId}`,
    organizationId: input.organizationId,
    tenantId: input.organizationId,
    topic: "domain_event_dispatch",
    status: "pending",
    entity: input.entity,
    workOrderId: input.workOrderId,
    sourceEventId: input.sourceEventId,
    correlationId: input.correlationId,
    causationId: input.causationId,
    idempotencyKey,
    actor: input.actor,
    payload: {
      eventId: input.sourceEventId,
      eventType: input.eventType,
    },
    availableAt: input.now,
    createdAt: input.now,
    updatedAt: input.now,
    processedAt: null,
    failureCount: 0,
    lastError: null,
  };
}

class FirestoreAtomicPersistenceContext implements AtomicPersistenceContext {
  private readonly operations: AtomicWriteOperation[] = [];

  constructor(
    private readonly firestore: Firestore,
    private readonly transaction: Transaction,
  ) {}

  create<TCollection extends AtomicCollectionName>(
    collection: TCollection,
    entity: PersistableEntityByCollection[TCollection],
  ): void {
    this.operations.push({
      action: "create",
      collection,
      id: entity.id,
      data: collectionConfig[collection].toDocument(entity as never),
    });
  }

  save<TCollection extends Exclude<AtomicCollectionName, "durableOutbox">>(
    collection: TCollection,
    entity: PersistableEntityByCollection[TCollection],
  ): void {
    this.operations.push({
      action: "set",
      collection,
      id: entity.id,
      data: collectionConfig[collection].toDocument(entity as never),
      merge: true,
    });
  }

  createRaw(input: AtomicWriteOperation): void {
    this.operations.push(input);
  }

  flush(): void {
    for (const operation of this.operations) {
      const ref = this.firestore
        .collection(collectionConfig[operation.collection].name)
        .doc(operation.id);
      if (operation.action === "create") {
        this.transaction.create(ref, operation.data);
        continue;
      }
      this.transaction.set(ref, operation.data, { merge: operation.merge });
    }
  }
}

function createFirestoreDurableOutboxService(
  firestore: Firestore,
): DurableOutboxService {
  const collection = firestore.collection(DURABLE_OUTBOX_COLLECTION);
  return {
    async getById(id) {
      const snapshot = await collection.doc(id).get();
      if (!snapshot.exists) {
        return null;
      }
      return durableOutboxFromDocument(snapshot.id, snapshot.data() as DocumentData);
    },
    async list(input = {}) {
      let query = collection.orderBy("createdAt", "asc") as FirebaseFirestore.Query<DocumentData>;
      if (input.organizationId) {
        query = query.where("organizationId", "==", input.organizationId);
      }
      if (input.status) {
        query = query.where("status", "==", input.status);
      }
      if (input.topic) {
        query = query.where("topic", "==", input.topic);
      }
      if (input.limit) {
        query = query.limit(input.limit);
      }
      const snapshot = await query.get();
      return snapshot.docs.map((document) =>
        durableOutboxFromDocument(document.id, document.data()),
      );
    },
    async save(record) {
      await collection.doc(record.id).set(durableOutboxToDocument(record), { merge: true });
    },
  };
}

function durableOutboxToDocument(record: DurableOutboxRecord): DocumentData {
  return {
    organizationId: record.organizationId,
    tenantId: record.tenantId,
    topic: record.topic,
    status: record.status,
    entity: record.entity,
    workOrderId: record.workOrderId,
    sourceEventId: record.sourceEventId,
    correlationId: record.correlationId,
    causationId: record.causationId,
    idempotencyKey: record.idempotencyKey,
    actor: record.actor,
    payload: record.payload,
    availableAt: record.availableAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    processedAt: record.processedAt,
    failureCount: record.failureCount,
    lastError: record.lastError,
  };
}

function durableOutboxFromDocument(
  id: EntityId,
  document: DocumentData,
): DurableOutboxRecord {
  return {
    id,
    organizationId: document.organizationId,
    tenantId: document.tenantId,
    topic: document.topic,
    status: document.status,
    entity: document.entity,
    workOrderId: document.workOrderId ?? null,
    sourceEventId: document.sourceEventId,
    correlationId: document.correlationId,
    causationId: document.causationId,
    idempotencyKey: document.idempotencyKey,
    actor: document.actor,
    payload: document.payload,
    availableAt: document.availableAt,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    processedAt: document.processedAt ?? null,
    failureCount: document.failureCount ?? 0,
    lastError: document.lastError ?? null,
  };
}
