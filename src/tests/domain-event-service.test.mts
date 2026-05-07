import assert from "node:assert/strict";
import test from "node:test";

import { createDomainEventService } from "../server/services/domain-event-service.ts";
import type {
  DomainEvent,
  TransitionAudit,
  TransitionEvent,
} from "../server/events/types.ts";
import type {
  DomainEventRepository,
  TransitionAuditRepository,
  TransitionEventRepository,
} from "../server/repositories/index.ts";
import { USER_ROLES } from "../types/permissions.ts";

test("recordTransition persists immutable domain, transition, and audit records", async () => {
  const harness = createEventRepoHarness();
  const service = createDomainEventService(harness.repositories);

  const result = await service.recordTransition({
    organizationId: "org-1",
    actor: { userId: "user-1", role: USER_ROLES.Manager },
    workOrderId: "wo-1",
    fromLifecycleStatus: "assigned",
    toLifecycleStatus: "on_hold",
    visibility: "internal",
    reason: "Awaiting client access",
    holdContext: { code: "awaiting_access" },
  });

  assert.equal(result.ok, true);
  assert.equal(harness.domainEvents.length, 1);
  assert.equal(harness.transitionEvents.length, 1);
  assert.equal(harness.transitionAudits.length, 1);
  assert.equal(harness.domainEvents[0].type, "lifecycle_transitioned");
  assert.equal(harness.transitionEvents[0].toLifecycleStatus, "on_hold");
  assert.deepEqual(harness.transitionAudits[0].holdContext, {
    code: "awaiting_access",
  });
  assert.equal(harness.transitionAudits[0].actor.actorRole, USER_ROLES.Manager);
});

test("timeline listing is ordered and visibility-filtered by actor", async () => {
  const harness = createEventRepoHarness();
  harness.domainEvents.push(
    makeDomainEvent({
      id: "evt-1",
      type: "note_added",
      visibility: "internal",
      occurredAt: "2026-05-06T10:00:00.000Z",
    }),
    makeDomainEvent({
      id: "evt-2",
      type: "invoice_sent",
      visibility: "client",
      occurredAt: "2026-05-06T11:00:00.000Z",
    }),
    makeDomainEvent({
      id: "evt-3",
      type: "contractor_contacted",
      visibility: "contractor",
      occurredAt: "2026-05-06T12:00:00.000Z",
    }),
    makeDomainEvent({
      id: "evt-4",
      type: "payment_recorded",
      visibility: "finance",
      occurredAt: "2026-05-06T13:00:00.000Z",
    }),
  );

  const service = createDomainEventService(harness.repositories);
  const clientResult = await service.listTimelineForWorkOrder("wo-1", {
    actorType: "client",
    userId: "client-1",
    role: USER_ROLES.ClientUser,
    scope: {
      kind: "client",
      organizationId: "org-1",
      clientOrganizationId: "client-org-1",
      locationAccess: { kind: "all_client_locations" },
    },
  });
  const financeResult = await service.listTimelineForWorkOrder("wo-1", {
    actorType: "internal",
    userId: "finance-1",
    role: USER_ROLES.FinanceAdmin,
    scope: { kind: "internal", organizationId: "org-1" },
  });

  assert.equal(clientResult.ok, true);
  assert.deepEqual(
    clientResult.value.map((entry) => entry.id),
    ["evt-2"],
  );
  assert.equal(financeResult.ok, true);
  assert.deepEqual(
    financeResult.value.map((entry) => entry.id),
    ["evt-4", "evt-3", "evt-2", "evt-1"],
  );
});

function createEventRepoHarness() {
  const domainEvents: DomainEvent[] = [];
  const transitionEvents: TransitionEvent[] = [];
  const transitionAudits: TransitionAudit[] = [];

  const repositories: {
    domainEvents: DomainEventRepository;
    transitionEvents: TransitionEventRepository;
    transitionAudits: TransitionAuditRepository;
  } = {
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
        throw new Error("domain events are immutable");
      },
      async listByOrganizationId(organizationId) {
        const items = domainEvents.filter((event) => event.organizationId === organizationId);
        return { items, count: items.length };
      },
      async listByWorkOrderId(workOrderId) {
        return {
          items: domainEvents.filter((event) => event.workOrderId === workOrderId),
          count: domainEvents.length,
        };
      },
      async listByEntity(entity) {
        const items = domainEvents.filter((event) =>
          event.entity.entityType === entity.entityType &&
          event.entity.entityId === entity.entityId
        );
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
        throw new Error("transition events are immutable");
      },
      async listByWorkOrderId(workOrderId) {
        return {
          items: transitionEvents.filter((event) => event.workOrderId === workOrderId),
          count: transitionEvents.length,
        };
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
        throw new Error("transition audits are immutable");
      },
      async listByWorkOrderId(workOrderId) {
        return {
          items: transitionAudits.filter((audit) => audit.workOrderId === workOrderId),
          count: transitionAudits.length,
        };
      },
    },
  };

  return { repositories, domainEvents, transitionEvents, transitionAudits };
}

function makeDomainEvent(overrides: Partial<DomainEvent>): DomainEvent {
  return {
    id: "evt-x",
    organizationId: "org-1",
    tenantId: "org-1",
    workOrderId: "wo-1",
    type: "work_order_created",
    actor: {
      actorId: "user-1",
      actorType: "user",
      actorRole: USER_ROLES.Manager,
      displayName: "Manager",
    },
    visibility: "internal",
    occurredAt: "2026-05-06T09:00:00.000Z",
    lifecycleStatus: "new",
    entity: {
      entityType: "work_order",
      entityId: "wo-1",
      label: "WO-1",
    },
    summary: "Created work order.",
    metadata: {
      requestId: null,
      reason: null,
      correlationId: null,
      details: {},
    },
    payload: {
      lifecycleStatus: "new",
      priority: "medium",
      title: "Broken faucet",
    },
    ...overrides,
  };
}
