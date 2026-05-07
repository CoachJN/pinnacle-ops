import type { DeliveryPlan } from "@/modules/delivery/index.ts";
import { createDeliveryServices } from "@/modules/delivery/index.ts";
import type { EscalationOrchestration } from "@/modules/escalation/index.ts";
import { createEscalationServices } from "@/modules/escalation/index.ts";
import type {
  ProviderReceipt,
  ProviderWebhookEvent,
} from "@/modules/provider-runtime/index.ts";
import {
  createMicrosoftGraphEmailAdapter,
  createProviderRuntimeServices,
} from "@/modules/provider-runtime/index.ts";
import type { DeliveryAttempt } from "@/modules/transport/index.ts";
import {
  createInternalTransportAdapter,
  createTransportServices,
  createTransportAttemptRepository,
} from "@/modules/transport/index.ts";
import type {
  EventProcessingRecord,
  EventSubscriberDefinition,
  WorkerDeadLetterRecord,
  WorkerJob,
} from "@/modules/runtime/index.ts";
import type { SlaScanCursor, SlaTimer } from "@/modules/sla/index.ts";
import { createSlaServices } from "@/modules/sla/index.ts";
import { createRuntimeServices } from "@/modules/runtime/server/worker-runtime-service.ts";
import type { DomainEvent, DomainEventType } from "@/server/events/types.ts";
import type {
  FirestoreRepositories,
  RepositoryListResult,
  WorkOrder,
} from "@/server/repositories/index.ts";
import { serviceOk, type DomainEventService } from "@/server/services/index.ts";
import type { RecordDomainEventInput } from "@/server/services/domain-event-service.ts";

export function createRuntimeHarness() {
  const jobs: WorkerJob[] = [];
  const deadLetters: WorkerDeadLetterRecord[] = [];
  const eventProcessings: EventProcessingRecord[] = [];
  const events: DomainEvent[] = [];
  const workOrders: WorkOrder[] = [];
  const escalationOrchestrations: EscalationOrchestration[] = [];
  const deliveryPlans: DeliveryPlan[] = [];
  const deliveryAttempts: DeliveryAttempt[] = [];
  const providerReceipts: ProviderReceipt[] = [];
  const providerWebhookEvents: ProviderWebhookEvent[] = [];
  const slaTimers: SlaTimer[] = [];
  const slaScanCursors: SlaScanCursor[] = [];

  const domainEventService = createDomainEventService(events);
  const repositories = {
    domainEvents: createDomainEventRepository(events),
    runtimeJobs: createWorkerJobRepository(jobs),
    runtimeDeadLetters: createWorkerDeadLetterRepository(deadLetters),
    runtimeEventProcessings: createEventProcessingRepository(eventProcessings),
    deliveryPlans: createDeliveryPlanRepository(deliveryPlans),
    deliveryAttempts: createDeliveryAttemptRepository(deliveryAttempts),
    escalationOrchestrations: createEscalationOrchestrationRepository(escalationOrchestrations),
    slaTimers: createSlaTimerRepository(slaTimers),
    slaScanCursors: createSlaScanCursorRepository(slaScanCursors),
    workOrders: createWorkOrderRepository(workOrders),
    userProfiles: createUserProfileRepository(),
  } as Pick<
    FirestoreRepositories,
    | "domainEvents"
    | "runtimeJobs"
    | "runtimeDeadLetters"
    | "runtimeEventProcessings"
    | "deliveryPlans"
    | "deliveryAttempts"
    | "escalationOrchestrations"
    | "slaTimers"
    | "slaScanCursors"
    | "workOrders"
    | "userProfiles"
  >;
  const sla = createSlaServices(
    repositories,
    {
      domainEvents: domainEventService,
    },
  );
  const escalation = createEscalationServices(
    repositories,
    {
      domainEvents: domainEventService,
    },
  );
  const delivery = createDeliveryServices(repositories, {
    domainEvents: domainEventService,
  });
  const transportRepository = createTransportAttemptRepository(repositories);
  const providerRuntime = createProviderRuntimeServices({
    domainEvents: domainEventService,
    attempts: transportRepository,
    getDeliveryPlanById: repositories.deliveryPlans.getById,
    saveDeliveryPlan: async (plan) => {
      await repositories.deliveryPlans.save(plan);
    },
    storage: {
      receipts: createProviderReceiptRepository(providerReceipts),
      webhookEvents: createProviderWebhookEventRepository(providerWebhookEvents),
    },
  });
  const transport = createTransportServices(repositories, {
    domainEvents: domainEventService,
    deliveryPolicy: delivery.policy,
    providerRuntime: providerRuntime.capture,
    adapters: [createInternalTransportAdapter(), createMicrosoftGraphEmailAdapter()],
  });

  const runtime = createRuntimeServices(
    repositories,
    {
      domainEvents: domainEventService,
      slaScheduler: sla.scheduler,
    },
  );

  return {
    runtime,
    repositories,
    jobs,
    deadLetters,
    eventProcessings,
    events,
    workOrders,
    escalationOrchestrations,
    deliveryPlans,
    deliveryAttempts,
    providerReceipts,
    providerWebhookEvents,
    slaTimers,
    slaScanCursors,
    sla,
    delivery,
    escalation,
    transport,
    providerRuntime,
  };
}

export function createRuntimeHarnessWithSubscribers(
  subscribers: readonly EventSubscriberDefinition[],
) {
  const harness = createRuntimeHarness();
  const runtime = createRuntimeServices(
    {
      domainEvents: createDomainEventRepository(harness.events),
      runtimeJobs: createWorkerJobRepository(harness.jobs),
      runtimeDeadLetters: createWorkerDeadLetterRepository(harness.deadLetters),
      runtimeEventProcessings: createEventProcessingRepository(harness.eventProcessings),
    },
    {
      domainEvents: createDomainEventService(harness.events),
      slaScheduler: harness.sla.scheduler,
      subscriberRegistry: {
        list: () =>
          subscribers.map((subscriber) => ({
            key: subscriber.key,
            name: subscriber.name,
            description: subscriber.description,
            eventTypes: subscriber.eventTypes,
            jobType: subscriber.jobType,
          })),
        getSubscribersForEventType: (eventType) =>
          subscribers.filter((subscriber) => subscriber.eventTypes.includes(eventType)),
      },
    },
  );

  return {
    ...harness,
    runtime,
  };
}

function createDeliveryPlanRepository(store: DeliveryPlan[]): FirestoreRepositories["deliveryPlans"] {
  return {
    newId() {
      return `delivery-${store.length + 1}`;
    },
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
    async findByIdempotencyKey(input) {
      return (
        store.find(
          (item) =>
            item.organizationId === input.organizationId &&
            item.deliveryType === input.deliveryType &&
            item.idempotencyKey === input.idempotencyKey,
        ) ?? null
      );
    },
    async findActiveForRecipient(input) {
      return (
        store.find(
          (item) =>
            item.organizationId === input.organizationId &&
            item.deliveryType === input.deliveryType &&
            item.sourceEscalationId === input.sourceEscalationId &&
            item.sourceEscalationStageNumber === input.sourceEscalationStageNumber &&
            item.recipientId === input.recipientId &&
            item.channel === input.channel &&
            (item.status === "planned" || item.status === "scheduled"),
        ) ?? null
      );
    },
    async listByOrganizationId(organizationId, options) {
      const items = store
        .filter((item) => item.organizationId === organizationId)
        .filter((item) => (options?.statuses?.length ? options.statuses.includes(item.status) : true))
        .filter((item) => (options?.channel ? item.channel === options.channel : true))
        .filter((item) => (options?.deliveryType ? item.deliveryType === options.deliveryType : true))
        .slice(0, options?.limit ?? store.length);
      return asList(items);
    },
    async listByEscalation(input) {
      const items = store
        .filter(
          (item) =>
            item.organizationId === input.organizationId &&
            item.sourceEscalationId === input.sourceEscalationId,
        )
        .slice(0, input.limit ?? store.length);
      return asList(items);
    },
  } as FirestoreRepositories["deliveryPlans"];
}

function createDeliveryAttemptRepository(store: DeliveryAttempt[]): FirestoreRepositories["deliveryAttempts"] {
  return {
    newId() {
      return `attempt-${store.length + 1}`;
    },
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
    async findByIdempotencyKey(input) {
      return (
        store.find(
          (item) =>
            item.organizationId === input.organizationId &&
            item.deliveryPlanId === input.deliveryPlanId &&
            item.idempotencyKey === input.idempotencyKey,
        ) ?? null
      );
    },
    async listByDeliveryPlanId(input) {
      const items = store
        .filter(
          (item) =>
            item.organizationId === input.organizationId &&
            item.deliveryPlanId === input.deliveryPlanId,
        )
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, input.limit ?? store.length);
      return asList(items);
    },
    async listByOrganizationId(organizationId, options) {
      const items = store
        .filter((item) => item.organizationId === organizationId)
        .filter((item) => (options?.statuses?.length ? options.statuses.includes(item.status) : true))
        .filter((item) => (options?.channel ? item.channel === options.channel : true))
        .filter((item) => (options?.adapterType ? item.adapterType === options.adapterType : true))
        .slice(0, options?.limit ?? store.length);
      return asList(items);
    },
  } as FirestoreRepositories["deliveryAttempts"];
}

function createProviderReceiptRepository(store: ProviderReceipt[]) {
  return {
    newId() {
      return `provider-receipt-${store.length + 1}`;
    },
    async getById(id: string) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity: ProviderReceipt) {
      store.push(entity);
    },
    async save(entity: ProviderReceipt) {
      upsertById(store, entity);
    },
    async findByIdempotencyKey(input: { organizationId: string; idempotencyKey: string }) {
      return (
        store.find(
          (item) =>
            item.organizationId === input.organizationId &&
            item.idempotencyKey === input.idempotencyKey,
        ) ?? null
      );
    },
    async findLatestForAttempt(input: { organizationId: string; deliveryAttemptId: string }) {
      return (
        store
          .filter(
            (item) =>
              item.organizationId === input.organizationId &&
              item.deliveryAttemptId === input.deliveryAttemptId,
          )
          .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt))[0] ?? null
      );
    },
    async listByOrganizationId(input: {
      organizationId: string;
      limit?: number;
      reconciliationStatus?: ProviderReceipt["reconciliationStatus"];
    }) {
      return store
        .filter((item) => item.organizationId === input.organizationId)
        .filter((item) =>
          input.reconciliationStatus ? item.reconciliationStatus === input.reconciliationStatus : true,
        )
        .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt))
        .slice(0, input.limit ?? store.length);
    },
    async listByDeliveryAttemptId(input: {
      organizationId: string;
      deliveryAttemptId: string;
      limit?: number;
    }) {
      return store
        .filter(
          (item) =>
            item.organizationId === input.organizationId &&
            item.deliveryAttemptId === input.deliveryAttemptId,
        )
        .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt))
        .slice(0, input.limit ?? store.length);
    },
  };
}

function createProviderWebhookEventRepository(store: ProviderWebhookEvent[]) {
  return {
    newId() {
      return `provider-webhook-${store.length + 1}`;
    },
    async getById(id: string) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity: ProviderWebhookEvent) {
      store.push(entity);
    },
    async save(entity: ProviderWebhookEvent) {
      upsertById(store, entity);
    },
    async findByIdempotencyKey(input: { organizationId: string; idempotencyKey: string }) {
      return (
        store.find(
          (item) =>
            item.organizationId === input.organizationId &&
            item.idempotencyKey === input.idempotencyKey,
        ) ?? null
      );
    },
    async listByOrganizationId(input: { organizationId: string; limit?: number }) {
      return store
        .filter((item) => item.organizationId === input.organizationId)
        .sort((left, right) => right.receivedAt.localeCompare(left.receivedAt))
        .slice(0, input.limit ?? store.length);
    },
  };
}

function createUserProfileRepository(): FirestoreRepositories["userProfiles"] {
  const users = [
    {
      id: "user-coordinator",
      email: "coord@example.com",
      displayName: "Coord",
      role: "coordinator",
      organizationId: "org-1",
      tenantId: "org-1",
      status: "active",
      clientOrganizationId: null,
      contractorOrganizationId: null,
      locationIds: [],
      lastLoginAt: null,
      recordStatus: "active",
      isDeleted: false,
      createdAt: "2026-05-06T00:00:00.000Z",
      updatedAt: "2026-05-06T00:00:00.000Z",
      createdByUserId: "system",
      updatedByUserId: "system",
    },
    {
      id: "user-manager",
      email: "manager@example.com",
      displayName: "Manager",
      role: "manager",
      organizationId: "org-1",
      tenantId: "org-1",
      status: "active",
      clientOrganizationId: null,
      contractorOrganizationId: null,
      locationIds: [],
      lastLoginAt: null,
      recordStatus: "active",
      isDeleted: false,
      createdAt: "2026-05-06T00:00:00.000Z",
      updatedAt: "2026-05-06T00:00:00.000Z",
      createdByUserId: "system",
      updatedByUserId: "system",
    },
    {
      id: "user-owner",
      email: "owner@example.com",
      displayName: "Owner",
      role: "owner",
      organizationId: "org-1",
      tenantId: "org-1",
      status: "active",
      clientOrganizationId: null,
      contractorOrganizationId: null,
      locationIds: [],
      lastLoginAt: null,
      recordStatus: "active",
      isDeleted: false,
      createdAt: "2026-05-06T00:00:00.000Z",
      updatedAt: "2026-05-06T00:00:00.000Z",
      createdByUserId: "system",
      updatedByUserId: "system",
    },
  ];
  return {
    newId() {
      return `user-${users.length + 1}`;
    },
    async getById(id) {
      return users.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      users.push(entity as (typeof users)[number]);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      const index = users.findIndex((item) => item.id === entity.id);
      if (index >= 0) {
        users[index] = entity as (typeof users)[number];
      } else {
        users.push(entity as (typeof users)[number]);
      }
      return { id: entity.id, item: entity };
    },
    async getByEmail(email) {
      return users.find((item) => item.email === email) ?? null;
    },
    async listByOrganizationId(organizationId, options) {
      return asList(users.filter((item) => item.organizationId === organizationId).slice(0, options?.limit ?? users.length));
    },
    async listByContractorOrganizationId() {
      return asList([]);
    },
  } as FirestoreRepositories["userProfiles"];
}

function createWorkOrderRepository(store: WorkOrder[]): FirestoreRepositories["workOrders"] {
  return {
    newId() {
      return `wo-${store.length + 1}`;
    },
    async getById(id: string) {
      return store.find((item) => item.id === id) ?? null;
    },
    async create(entity: WorkOrder) {
      store.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity: WorkOrder) {
      upsertById(store, entity);
      return { id: entity.id, item: entity };
    },
    async listByOrganizationId(
      organizationId: string,
      options?: { limit?: number },
    ) {
      const items = store
        .filter((item) => item.organizationId === organizationId)
        .slice(0, options?.limit ?? store.length);
      return asList(items);
    },
    async listByClientOrganizationId() {
      return asList([]);
    },
    async listByLocationId() {
      return asList([]);
    },
    async listByContractorOrganizationId() {
      return asList([]);
    },
    async listByCoordinatorUserId() {
      return asList([]);
    },
    async listByManagerUserId() {
      return asList([]);
    },
  } as unknown as FirestoreRepositories["workOrders"];
}

function createSlaTimerRepository(store: SlaTimer[]): FirestoreRepositories["slaTimers"] {
  return {
    newId() {
      return `sla-${store.length + 1}`;
    },
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
    async findByIdempotencyKey(input) {
      return store.find((item) =>
        item.organizationId === input.organizationId &&
        item.type === input.type &&
        item.idempotencyKey === input.idempotencyKey
      ) ?? null;
    },
    async listByOrganizationId(organizationId, options) {
      const items = store
        .filter((item) => item.organizationId === organizationId)
        .filter((item) => (options?.type ? item.type === options.type : true))
        .filter((item) => (options?.statuses?.length ? options.statuses.includes(item.status) : true))
        .slice(0, options?.limit ?? store.length);
      return asList(items);
    },
    async scanScheduledDueTimers(input) {
      const items = store
        .filter((item) => item.organizationId === input.organizationId)
        .filter((item) => item.status === "scheduled")
        .filter((item) => item.dueAt <= input.dueBefore)
        .filter((item) => (input.type ? item.type === input.type : true))
        .sort((left, right) => left.dueAt.localeCompare(right.dueAt) || left.id.localeCompare(right.id))
        .filter((item) => {
          if (!input.after) {
            return true;
          }
          return (
            item.dueAt > input.after.dueAt ||
            (item.dueAt === input.after.dueAt && item.id > input.after.id)
          );
        })
        .slice(0, input.limit);
      return asList(items);
    },
  };
}

function createSlaScanCursorRepository(
  store: SlaScanCursor[],
): FirestoreRepositories["slaScanCursors"] {
  return {
    newId() {
      return `sla-scan-cursor-${store.length + 1}`;
    },
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
    async findByScanType(input) {
      return store.find((item) =>
        item.organizationId === input.organizationId &&
        item.scanType === input.scanType &&
        item.timerType === (input.timerType ?? null)
      ) ?? null;
    },
    async listByOrganizationId(organizationId, options) {
      const items = store
        .filter((item) => item.organizationId === organizationId)
        .filter((item) => (options?.scanType ? item.scanType === options.scanType : true))
        .slice(0, options?.limit ?? store.length);
      return asList(items);
    },
  };
}

function createWorkerJobRepository(store: WorkerJob[]): FirestoreRepositories["runtimeJobs"] {
  return {
    newId() {
      return `job-${store.length + 1}`;
    },
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
    async findByIdempotencyKey(input) {
      return store.find((item) =>
        item.organizationId === input.organizationId &&
        item.type === input.type &&
        item.idempotencyKey === input.idempotencyKey
      ) ?? null;
    },
    async listByOrganizationId(organizationId, options) {
      const items = store
        .filter((item) => item.organizationId === organizationId)
        .slice(0, options?.limit ?? store.length);
      return asList(items);
    },
    async listByTimer(input) {
      const items = store
        .filter((item) => item.organizationId === input.organizationId)
        .filter((item) => item.type === "sla.timer.evaluate")
        .filter((item) => item.payload.timerId === input.timerId)
        .filter((item) => (input.statuses?.length ? input.statuses.includes(item.status) : true))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
        .slice(0, input.limit ?? store.length);
      return asList(items);
    },
    async claimNext(input) {
      const queued = store
        .filter((item) =>
          item.organizationId === input.organizationId &&
          item.status === "queued" &&
          item.runAfter <= input.now &&
          (!input.jobTypes?.length || input.jobTypes.includes(item.type))
        )
        .sort((left, right) => left.runAfter.localeCompare(right.runAfter))[0] ?? null;
      if (queued) {
        const claimed = {
          ...queued,
          status: "leased" as const,
          leasedBy: input.workerId,
          leaseExpiresAt: new Date(Date.parse(input.now) + input.leaseDurationMs).toISOString(),
          updatedAt: input.now,
          attemptCount: queued.attemptCount + 1,
        };
        upsertById(store, claimed);
        return claimed;
      }

      const expired = store
        .filter((item) =>
          item.organizationId === input.organizationId &&
          (item.status === "leased" || item.status === "running") &&
          item.leaseExpiresAt !== null &&
          item.leaseExpiresAt <= input.now &&
          (!input.jobTypes?.length || input.jobTypes.includes(item.type))
        )
        .sort((left, right) => (left.leaseExpiresAt ?? "").localeCompare(right.leaseExpiresAt ?? ""))[0] ?? null;
      if (!expired) {
        return null;
      }

      const reclaimed = {
        ...expired,
        status: "leased" as const,
        leasedBy: input.workerId,
        leaseExpiresAt: new Date(Date.parse(input.now) + input.leaseDurationMs).toISOString(),
        updatedAt: input.now,
        attemptCount: expired.attemptCount + 1,
      };
      upsertById(store, reclaimed);
      return reclaimed;
    },
  };
}

function createWorkerDeadLetterRepository(
  store: WorkerDeadLetterRecord[],
): FirestoreRepositories["runtimeDeadLetters"] {
  return {
    newId() {
      return `dead-letter-${store.length + 1}`;
    },
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
    async listByOrganizationId(organizationId, options) {
      const items = store
        .filter((item) => item.organizationId === organizationId)
        .slice(0, options?.limit ?? store.length);
      return asList(items);
    },
    async findByOriginalJobId(originalJobId) {
      return store.find((item) => item.originalJobId === originalJobId) ?? null;
    },
  };
}

function createEventProcessingRepository(
  store: EventProcessingRecord[],
): FirestoreRepositories["runtimeEventProcessings"] {
  return {
    newId() {
      return `event-processing-${store.length + 1}`;
    },
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
    async findBySubscriberEvent(input) {
      return store.find((item) =>
        item.organizationId === input.organizationId &&
        item.subscriberKey === input.subscriberKey &&
        item.sourceEventId === input.sourceEventId
      ) ?? null;
    },
    async listByOrganizationId(organizationId, options) {
      const items = store
        .filter((item) => item.organizationId === organizationId)
        .filter((item) => (options?.subscriberKey ? item.subscriberKey === options.subscriberKey : true))
        .filter((item) => (options?.sourceEventId ? item.sourceEventId === options.sourceEventId : true))
        .filter((item) => (options?.status ? item.status === options.status : true))
        .slice(0, options?.limit ?? store.length);
      return asList(items);
    },
  };
}

function createEscalationOrchestrationRepository(
  store: EscalationOrchestration[],
): FirestoreRepositories["escalationOrchestrations"] {
  return {
    newId() {
      return `esc-${store.length + 1}`;
    },
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
    async findByIdempotencyKey(input) {
      return store.find((item) =>
        item.organizationId === input.organizationId &&
        item.escalationType === input.escalationType &&
        item.idempotencyKey === input.idempotencyKey
      ) ?? null;
    },
    async findLatestByTimer(input) {
      return store
        .filter((item) => item.organizationId === input.organizationId)
        .filter((item) => item.escalationType === input.escalationType)
        .filter((item) => item.sourceSlaTimerId === input.sourceSlaTimerId)
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
    },
    async findOpenByCondition(input) {
      return store
        .filter((item) => item.organizationId === input.organizationId)
        .filter((item) => item.escalationType === input.escalationType)
        .filter((item) => item.targetEntityType === input.targetEntityType)
        .filter((item) => item.targetEntityId === input.targetEntityId)
        .find((item) => item.status === "active" || item.status === "completed") ?? null;
    },
    async listByOrganizationId(organizationId, options) {
      const items = store
        .filter((item) => item.organizationId === organizationId)
        .filter((item) => (options?.statuses?.length ? options.statuses.includes(item.status) : true))
        .filter((item) => (options?.escalationType ? item.escalationType === options.escalationType : true))
        .slice(0, options?.limit ?? store.length);
      return asList(items);
    },
  };
}

function createDomainEventService(events: DomainEvent[]): DomainEventService {
  return {
    async record<TType extends DomainEventType>(input: RecordDomainEventInput<TType>) {
      const event = {
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
        occurredAt: input.now ?? new Date().toISOString(),
        lifecycleStatus: input.lifecycleStatus,
        entity: input.entity,
        summary: input.summary,
        metadata: {
          requestId: input.requestId ?? null,
          reason: input.reason ?? null,
          correlationId: input.correlationId ?? null,
          details: {},
        },
        payload: input.payload,
      } as DomainEvent<TType>;
      events.push(event as DomainEvent);
      return serviceOk(event);
    },
    async recordTransition() {
      throw new Error("Not implemented in runtime harness.");
    },
    async listTimelineForWorkOrder() {
      return serviceOk([]);
    },
    async listTimelineForEntity() {
      return serviceOk([]);
    },
  };
}

function createDomainEventRepository(events: DomainEvent[]): FirestoreRepositories["domainEvents"] {
  return {
    newId() {
      return `event-${events.length + 1}`;
    },
    async getById(id) {
      return events.find((item) => item.id === id) ?? null;
    },
    async create(entity) {
      events.push(entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      upsertById(events, entity);
      return { id: entity.id, item: entity };
    },
    async listByOrganizationId(organizationId, options) {
      const items = events
        .filter((item) => item.organizationId === organizationId)
        .slice(0, options?.limit ?? events.length);
      return asList(items);
    },
    async listByWorkOrderId(workOrderId, options) {
      const items = events
        .filter((item) => item.workOrderId === workOrderId)
        .slice(0, options?.limit ?? events.length);
      return asList(items);
    },
    async listByEntity(entity, options) {
      const items = events
        .filter((item) => item.entity.entityType === entity.entityType)
        .filter((item) => item.entity.entityId === entity.entityId)
        .slice(0, options?.limit ?? events.length);
      return asList(items);
    },
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

function asList<T>(items: T[]): RepositoryListResult<T> {
  return { items, count: items.length };
}
