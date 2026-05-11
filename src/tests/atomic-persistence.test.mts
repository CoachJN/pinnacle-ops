import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDurableOutboxRecord,
  type AtomicPersistenceContext,
  type AtomicPersistenceService,
  type DurableOutboxRecord,
  type DurableOutboxService,
} from "../server/services/atomic-persistence-service.ts";
import { createDomainEventService, type RecordTransitionAuditInput } from "../server/services/domain-event-service.ts";
import { createWorkOrderService } from "../server/services/work-order-service.ts";
import { createDurableOutboxReplayService } from "../server/services/durable-outbox-replay-service.ts";
import type { DomainEventService } from "../server/services/index.ts";
import type {
  DomainEvent,
  TransitionAudit,
  TransitionEvent,
} from "../server/events/types.ts";
import type {
  DomainEventRepository,
  FirestoreRepositories,
  TransitionAuditRepository,
  TransitionEventRepository,
  WorkOrder,
} from "../server/repositories/index.ts";
import { serviceOk } from "../server/services/types.ts";
import { USER_ROLES } from "../types/permissions.ts";

test("atomic work-order transition rolls back authoritative mutation when commit fails", async () => {
  const harness = createAtomicHarness();
  harness.failCommit = true;

  const workOrders = createWorkOrderService(
    {
      workOrders: harness.workOrderRepository,
      clientQuotes: createEmptyRepository(),
      clientInvoices: createEmptyRepository(),
      clientOrganizations: createEmptyRepository(),
      locations: createEmptyRepository(),
      contractorOrganizations: createEmptyRepository(),
    } as unknown as Pick<
      FirestoreRepositories,
      "workOrders" | "clientQuotes" | "clientInvoices" | "clientOrganizations" | "locations" | "contractorOrganizations"
    >,
    {
      domainEvents: harness.domainEventService,
      atomicPersistence: harness.atomicPersistence,
      clientLocations: {
        async getClientLocationContext() {
          throw new Error("not used");
        },
      } as never,
    },
  );

  await assert.rejects(() =>
    workOrders.transition({
      organizationId: "org-1",
      actor: {
        actorType: "internal",
        userId: "manager-1",
        role: USER_ROLES.Manager,
        scope: { kind: "internal", organizationId: "org-1" },
      },
      source: "work_order_api",
      workOrderId: "wo-1",
      toStatus: "triage",
      now: "2026-05-07T10:00:00.000Z",
    }),
  );

  assert.equal(harness.workOrders[0]?.lifecycleStatus, "new");
  assert.equal(harness.domainEvents.length, 0);
  assert.equal(harness.transitionEvents.length, 0);
  assert.equal(harness.transitionAudits.length, 0);
  assert.equal(harness.outbox.length, 0);
});

test("atomic domain-event transition persists durable outbox alongside transition records", async () => {
  const harness = createAtomicHarness();
  const service = createDomainEventService(harness.repositories, {
    atomicPersistence: harness.atomicPersistence,
  });

  const result = await service.recordTransition({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: USER_ROLES.Manager },
    requestId: "req-1",
    workOrderId: "wo-1",
    fromLifecycleStatus: "assigned",
    toLifecycleStatus: "on_hold",
    visibility: "internal",
    reason: "Awaiting access",
    holdContext: { code: "awaiting_access" },
  });

  assert.equal(result.ok, true);
  assert.equal(harness.domainEvents.length, 1);
  assert.equal(harness.transitionEvents.length, 1);
  assert.equal(harness.transitionAudits.length, 1);
  assert.equal(harness.outbox.length, 1);
  assert.equal(harness.outbox[0]?.sourceEventId, harness.domainEvents[0]?.id);
  assert.equal(harness.outbox[0]?.topic, "domain_event_dispatch");
});

test("durable outbox replay marks pending records processed after subscriber dispatch", async () => {
  const outbox: DurableOutboxRecord[] = [
    buildDurableOutboxRecord({
      organizationId: "org-1",
      workOrderId: "wo-1",
      sourceEventId: "evt-1",
      correlationId: "corr-1",
      causationId: "evt-1",
      actor: {
        actorId: "system",
        actorType: "system",
        actorRole: "system",
        displayName: null,
      },
      entity: {
        entityType: "work_order",
        entityId: "wo-1",
        label: "WO-1",
      },
      eventType: "work_order_created",
      now: "2026-05-07T10:00:00.000Z",
    }),
  ];
  const calls: string[] = [];
  const service = createDurableOutboxReplayService(
    createInMemoryOutboxService(outbox),
    {
      listRegistered() {
        return [];
      },
      async processEvent() {
        return serviceOk([]);
      },
      async processEventById(input) {
        calls.push(input.eventId);
        return serviceOk([]);
      },
      async listProcessingRecords() {
        return serviceOk([]);
      },
    },
  );

  const result = await service.replayPending({
    organizationId: "org-1",
    now: "2026-05-07T10:05:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["evt-1"]);
  assert.equal(outbox[0]?.status, "processed");
  assert.equal(outbox[0]?.processedAt, "2026-05-07T10:05:00.000Z");
});

function createAtomicHarness() {
  const workOrders: WorkOrder[] = [makeWorkOrder()];
  const domainEvents: DomainEvent[] = [];
  const transitionEvents: TransitionEvent[] = [];
  const transitionAudits: TransitionAudit[] = [];
  const outbox: DurableOutboxRecord[] = [];

  const repositories = createEventRepositories(domainEvents, transitionEvents, transitionAudits);
  const workOrderRepository = createWorkOrderRepository(workOrders);
  let failCommit = false;

  const atomicPersistence: AtomicPersistenceService = {
    async runInTransaction(callback) {
      const staged = {
        workOrders: [...workOrders],
        domainEvents: [...domainEvents],
        transitionEvents: [...transitionEvents],
        transitionAudits: [...transitionAudits],
        outbox: [...outbox],
      };
      const context: AtomicPersistenceContext = {
        create(collection, entity) {
          applyStage(staged, collection, entity, false);
        },
        save(collection, entity) {
          applyStage(staged, collection, entity, true);
        },
        createRaw() {
          throw new Error("raw writes not used in atomic test harness");
        },
      };
      const result = await callback(context);
      if (failCommit) {
        throw new Error("simulated_atomic_commit_failure");
      }
      replaceStore(workOrders, staged.workOrders);
      replaceStore(domainEvents, staged.domainEvents);
      replaceStore(transitionEvents, staged.transitionEvents);
      replaceStore(transitionAudits, staged.transitionAudits);
      replaceStore(outbox, staged.outbox);
      return result;
    },
    createDurableOutboxService() {
      return createInMemoryOutboxService(outbox);
    },
  };

  const domainEventService = createDomainEventService(repositories, {
    atomicPersistence,
  });

  return {
    workOrders,
    domainEvents,
    transitionEvents,
    transitionAudits,
    outbox,
    repositories,
    workOrderRepository,
    domainEventService,
    atomicPersistence,
    get failCommit() {
      return failCommit;
    },
    set failCommit(value: boolean) {
      failCommit = value;
    },
  };
}

function createInMemoryOutboxService(store: DurableOutboxRecord[]): DurableOutboxService {
  return {
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async list(input = {}) {
      return store
        .filter((item) => (input.organizationId ? item.organizationId === input.organizationId : true))
        .filter((item) => (input.status ? item.status === input.status : true))
        .filter((item) => (input.topic ? item.topic === input.topic : true))
        .slice(0, input.limit ?? store.length);
    },
    async save(record) {
      const index = store.findIndex((item) => item.id === record.id);
      if (index >= 0) {
        store[index] = record;
      } else {
        store.push(record);
      }
    },
  };
}

function createEventRepositories(
  domainEvents: DomainEvent[],
  transitionEvents: TransitionEvent[],
  transitionAudits: TransitionAudit[],
): {
  domainEvents: DomainEventRepository;
  transitionEvents: TransitionEventRepository;
  transitionAudits: TransitionAuditRepository;
} {
  return {
    domainEvents: {
      newId: () => `evt-${domainEvents.length + 1}`,
      async getById(id) {
        return domainEvents.find((event) => event.id === id) ?? null;
      },
      async create(entity) {
        domainEvents.push(entity);
        return { id: entity.id, item: entity };
      },
      async save() {
        throw new Error("immutable");
      },
      async listByOrganizationId() {
        return { items: domainEvents, count: domainEvents.length };
      },
      async listByWorkOrderId(workOrderId) {
        const items = domainEvents.filter((event) => event.workOrderId === workOrderId);
        return { items, count: items.length };
      },
      async listByEntity(entity) {
        const items = domainEvents.filter((event) => event.entity.entityId === entity.entityId);
        return { items, count: items.length };
      },
    },
    transitionEvents: {
      newId: () => `te-${transitionEvents.length + 1}`,
      async getById(id) {
        return transitionEvents.find((event) => event.id === id) ?? null;
      },
      async create(entity) {
        transitionEvents.push(entity);
        return { id: entity.id, item: entity };
      },
      async save() {
        throw new Error("immutable");
      },
      async listByWorkOrderId() {
        return { items: transitionEvents, count: transitionEvents.length };
      },
    },
    transitionAudits: {
      newId: () => `ta-${transitionAudits.length + 1}`,
      async getById(id) {
        return transitionAudits.find((audit) => audit.id === id) ?? null;
      },
      async create(entity) {
        transitionAudits.push(entity);
        return { id: entity.id, item: entity };
      },
      async save() {
        throw new Error("immutable");
      },
      async listByWorkOrderId() {
        return { items: transitionAudits, count: transitionAudits.length };
      },
    },
  };
}

function createWorkOrderRepository(store: WorkOrder[]): FirestoreRepositories["workOrders"] {
  return {
    newId() {
      return `wo-${store.length + 1}`;
    },
    async getById(id) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      const index = store.findIndex((item) => item.id === entity.id);
      if (index >= 0) {
        store[index] = entity;
      } else {
        store.push(entity);
      }
      return { id: entity.id, item: entity };
    },
    async listByOrganizationId() {
      return { items: store, count: store.length };
    },
    async listByClientOrganizationId() {
      return { items: store, count: store.length };
    },
    async listByLocationId() {
      return { items: store, count: store.length };
    },
    async listByCoordinatorUserId() {
      return { items: store, count: store.length };
    },
    async listByManagerUserId() {
      return { items: store, count: store.length };
    },
    async listByContractorOrganizationId() {
      return { items: store, count: store.length };
    },
  } as FirestoreRepositories["workOrders"];
}

function createEmptyRepository() {
  return {
    async getById() {
      return null;
    },
    async listByWorkOrderId() {
      return { items: [], count: 0 };
    },
  };
}

function applyStage(
  staged: {
    workOrders: WorkOrder[];
    domainEvents: DomainEvent[];
    transitionEvents: TransitionEvent[];
    transitionAudits: TransitionAudit[];
    outbox: DurableOutboxRecord[];
  },
  collection: string,
  entity: { id: string },
  merge: boolean,
) {
  const target =
    collection === "workOrders"
      ? staged.workOrders
      : collection === "domainEvents"
        ? staged.domainEvents
        : collection === "transitionEvents"
          ? staged.transitionEvents
          : collection === "transitionAudits"
            ? staged.transitionAudits
            : staged.outbox;
  const index = target.findIndex((item) => item.id === entity.id);
  if (index >= 0) {
    if (!merge) {
      throw new Error("already-exists");
    }
    target[index] = entity as never;
    return;
  }
  target.push(entity as never);
}

function replaceStore<T>(target: T[], next: readonly T[]) {
  target.splice(0, target.length, ...next);
}

function makeWorkOrder(): WorkOrder {
  return {
    id: "wo-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-05-07T09:00:00.000Z",
    updatedAt: "2026-05-07T09:00:00.000Z",
    createdByUserId: "manager-1",
    updatedByUserId: "manager-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderNumber: "WO-1",
    title: "Broken freezer",
    description: "Needs repair",
    poNumber: null,
    requestedByName: null,
    requestedByEmail: null,
    requestedByPhone: null,
    requestedServiceDate: null,
    dueDate: null,
    category: "HVAC",
    requiresQuote: false,
    quoteRequiredThresholdCents: null,
    lifecycleStatus: "new",
    status: "new",
    assignmentStatus: null,
    quoteSummaryStatus: "not_required",
    invoiceSummaryStatus: "not_ready",
    approvalStatus: "not_required",
    priority: "medium",
    clientOrganizationId: "client-org-1",
    locationId: "loc-1",
    requestedByContactId: null,
    siteContactId: null,
    coordinatorUserId: null,
    managerUserId: null,
    assignedCoordinatorUserId: null,
    assignedManagerUserId: null,
    assignedContractorOrgId: null,
    assignedContractorContactId: null,
    financeOwnerUserId: null,
    quoteReviewerUserId: null,
    currentQuoteId: null,
    currentInvoiceId: null,
    currentQuoteVersionNumber: null,
    invoiceNumber: null,
    clientSnapshot: { id: "client-org-1", name: "Client" },
    locationSnapshot: { id: "loc-1", name: "Store 1", addressText: null },
    contractorSnapshot: null,
    lastActivityAt: "2026-05-07T09:00:00.000Z",
    nextActionOwnerType: null,
    nextActionDueAt: null,
    isEscalated: false,
    escalationReason: null,
    holdReason: null,
    previousLifecycleStatus: null,
    intakeReceivedAt: "2026-05-07T09:00:00.000Z",
    triagedAt: null,
    assignedAt: null,
    contractorContactedAt: null,
    contractorRespondedAt: null,
    contractorScheduledAt: null,
    workStartedAt: null,
    quoteRequestedAt: null,
    contractorQuoteReceivedAt: null,
    quoteReviewStartedAt: null,
    clientApprovalRequestedAt: null,
    clientApprovedAt: null,
    workCompletedAt: null,
    completionReviewStartedAt: null,
    readyForInvoicingAt: null,
    invoiceSentAt: null,
    paidAt: null,
    closedAt: null,
    cancelledAt: null,
    holdStartedAt: null,
    escalatedAt: null,
  };
}
