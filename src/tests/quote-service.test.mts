import assert from "node:assert/strict";
import test from "node:test";

import { createQuoteService } from "../server/services/quote-service.ts";
import type { ActivityLogService } from "../server/services/activity-log-service.ts";
import type {
  Quote,
  QuoteRepository,
  RepositoryListResult,
  WorkOrder,
  WorkOrderRepository,
} from "../server/repositories/index.ts";
import type { EntityId } from "../types/entity.ts";

test("quote creation is blocked outside quote workflow states", async () => {
  const harness = createHarness({
    workOrder: makeWorkOrder({ status: "approved_to_proceed" }),
  });

  const result = await harness.service.create({
    ...auditContext(),
    workOrderId: harness.workOrder.id,
    contractorOrganizationId: "contractor-1",
    laborAmount: 100,
    materialAmount: 50,
    otherAmount: 25,
    currency: "CAD",
    scopeSummary: "Replace damaged valve",
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /quote-required work orders/i);
  assert.equal(harness.quoteStore.size, 0);
});

test("creating a revised quote supersedes the prior non-terminal quote", async () => {
  const existingQuote = makeQuote({
    id: "quote-v1",
    versionNumber: 1,
    status: "submitted",
  });
  const harness = createHarness({
    workOrder: makeWorkOrder({
      status: "quote_received",
      currentQuoteId: existingQuote.id,
      assignedContractorOrganizationId: "contractor-1",
      contractorSnapshot: { id: "contractor-1", name: "Summit Mechanical" },
    }),
    quotes: [existingQuote],
  });

  const result = await harness.service.create({
    ...auditContext(),
    workOrderId: harness.workOrder.id,
    contractorOrganizationId: "contractor-1",
    laborAmount: 150,
    materialAmount: 75,
    otherAmount: 25,
    currency: "CAD",
    scopeSummary: "Provide revised scope and pricing",
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.value.versionNumber, 2);
  assert.equal(harness.quoteStore.get(existingQuote.id)?.status, "superseded");
  assert.equal(harness.workOrderStore.get(harness.workOrder.id)?.currentQuoteId, result.value.id);
});

test("client-approved quotes are terminal and cannot be reopened", async () => {
  const quote = makeQuote({ status: "client_approved" });
  const harness = createHarness({
    workOrder: makeWorkOrder({
      status: "approved_to_proceed",
      currentQuoteId: quote.id,
    }),
    quotes: [quote],
  });

  const result = await harness.service.transition({
    ...auditContext(),
    workOrderId: harness.workOrder.id,
    quoteId: quote.id,
    toStatus: "submitted",
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /terminal/i);
});

test("client approval advances the current work order and records workflow activity", async () => {
  const quote = makeQuote({ status: "ready_for_client" });
  const harness = createHarness({
    workOrder: makeWorkOrder({
      status: "pending_client_approval",
      currentQuoteId: quote.id,
    }),
    quotes: [quote],
  });

  const result = await harness.service.transition({
    ...auditContext(),
    now: "2026-04-12T15:00:00.000Z",
    workOrderId: harness.workOrder.id,
    quoteId: quote.id,
    toStatus: "client_approved",
    clientResponseNotes: "Approved by client contact",
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.value.status, "client_approved");
  assert.equal(harness.workOrderStore.get(harness.workOrder.id)?.status, "approved_to_proceed");
  assert.equal(
    harness.activityEvents.some((event) => event.action === "work_order.status_changed"),
    true,
  );
});

function createHarness(input: {
  workOrder: WorkOrder;
  quotes?: Quote[];
}) {
  const workOrderStore = new Map<EntityId, WorkOrder>([[input.workOrder.id, input.workOrder]]);
  const quoteStore = new Map<EntityId, Quote>(
    (input.quotes ?? []).map((quote) => [quote.id, quote]),
  );
  const activityEvents: Array<{ action: string; eventType: string; message: string }> = [];

  const workOrders: Pick<WorkOrderRepository, "getById" | "save"> = {
    async getById(id) {
      return workOrderStore.get(id) ?? null;
    },
    async save(entity) {
      workOrderStore.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
  };

  const quotes: Pick<
    QuoteRepository,
    "newId" | "getById" | "create" | "save" | "listByWorkOrderId"
  > = {
    newId() {
      return "quote-created";
    },
    async getById(id) {
      return quoteStore.get(id) ?? null;
    },
    async create(entity) {
      quoteStore.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      quoteStore.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
    async listByWorkOrderId(workOrderId) {
      return toListResult(
        [...quoteStore.values()].filter((quote) => quote.workOrderId === workOrderId),
      );
    },
  };

  const activityLogs: ActivityLogService = {
    async listForWorkOrder() {
      return { ok: true, value: [] };
    },
    async record(input) {
      activityEvents.push({
        action: input.action,
        eventType: input.eventType,
        message: input.message,
      });
      return {
        ok: true,
        value: {
          id: `activity-${activityEvents.length}`,
          ...baseAuditFields(),
          workOrderId: input.workOrderId,
          action: input.action,
          eventType: input.eventType,
          message: input.message,
          actorType: input.actor.role === "system" ? "system" : "user",
          actorUserId: input.actor.role === "system" ? null : input.actor.userId,
          actorRole: input.actor.role,
          actor: {
            type: input.actor.role === "system" ? "system" : "user",
            userId: input.actor.role === "system" ? null : input.actor.userId,
            role: input.actor.role,
          },
          resourceType: input.entityType,
          resourceId: input.entityId,
          resourceLabel: input.entityLabel ?? null,
          resource: {
            type: input.entityType,
            id: input.entityId,
            label: input.entityLabel ?? null,
            workOrderId: input.workOrderId,
          },
          entityType: input.entityType,
          entityId: input.entityId,
          occurredAt: input.now ?? "2026-04-11T00:00:00.000Z",
          requestId: input.requestId ?? null,
          visibility: input.visibility ?? "internal",
          changes: input.changes ?? [],
          metadata: input.metadata ?? {},
        },
      };
    },
  };

  return {
    workOrder: input.workOrder,
    workOrderStore,
    quoteStore,
    activityEvents,
    service: createQuoteService(
      {
        workOrders: workOrders as WorkOrderRepository,
        quotes: quotes as QuoteRepository,
      },
      { activityLogs },
    ),
  };
}

function makeWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: "wo-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-11T00:00:00.000Z",
    updatedAt: "2026-04-11T00:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderNumber: "WO-1001",
    title: "Generator repair quote",
    description: "Prepare client-facing quote",
    status: "quote_requested",
    priority: "medium",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    requestedByUserId: "user-1",
    assignedCoordinatorUserId: "coord-1",
    assignedManagerUserId: "mgr-1",
    assignedContractorOrganizationId: null,
    currentQuoteId: null,
    currentInvoiceId: null,
    clientSnapshot: { id: "client-1", name: "Client One" },
    locationSnapshot: { id: "loc-1", name: "HQ", addressText: "123 Main St" },
    contractorSnapshot: null,
    category: "Electrical",
    requestedServiceDate: null,
    submittedAt: null,
    approvedAt: null,
    completedAt: null,
    closedAt: null,
    ...overrides,
  };
}

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "quote-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-11T00:00:00.000Z",
    updatedAt: "2026-04-11T00:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderId: "wo-1",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    contractorOrganizationId: "contractor-1",
    versionNumber: 1,
    status: "draft",
    laborAmount: 100,
    materialAmount: 50,
    otherAmount: 25,
    totalAmount: 175,
    currency: "CAD",
    scopeSummary: "Replace damaged valve",
    contractorNotes: null,
    internalReviewNotes: null,
    clientResponseNotes: null,
    submittedByUserId: null,
    submittedAt: null,
    reviewedAt: null,
    clientDecisionAt: null,
    workOrderSnapshot: { id: "wo-1", name: "WO-1001" },
    contractorSnapshot: { id: "contractor-1", name: "Summit Mechanical" },
    ...overrides,
  };
}

function auditContext() {
  return {
    organizationId: "org-1",
    actor: {
      userId: "user-1",
      role: "manager" as const,
    },
    requestId: "req-1",
  };
}

function baseAuditFields() {
  return {
    organizationId: "org-1",
    recordStatus: "active" as const,
    isDeleted: false,
    createdAt: "2026-04-11T00:00:00.000Z",
    updatedAt: "2026-04-11T00:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    deletedAt: null,
    deletedByUserId: null,
  };
}

function toListResult<TEntity>(items: TEntity[]): RepositoryListResult<TEntity> {
  return {
    items,
    count: items.length,
  };
}
