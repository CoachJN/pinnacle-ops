import assert from "node:assert/strict";
import test from "node:test";

import { createWorkOrderService } from "../server/services/work-order-service.ts";
import type { ActivityLogService } from "../server/services/activity-log-service.ts";
import type { ClientLocationService } from "../server/services/client-location-service.ts";
import { notFoundError, validationError } from "../server/services/errors.ts";
import { serviceFail, serviceOk } from "../server/services/types.ts";
import type {
  ClientOrganization,
  ClientOrganizationRepository,
  ContractorOrganizationRepository,
  Invoice,
  InvoiceRepository,
  Location,
  LocationRepository,
  Quote,
  QuoteRepository,
  RepositoryListResult,
  WorkOrder,
  WorkOrderRepository,
} from "../server/repositories/index.ts";
import type { EntityId } from "../types/entity.ts";

test("work order service blocks invalid lifecycle shortcuts", async () => {
  const harness = createHarness({
    workOrder: makeWorkOrder({ status: "new" }),
  });

  const result = await harness.service.transition({
    ...auditContext(),
    workOrderId: harness.workOrder.id,
    toStatus: "completed",
    completionAccepted: true,
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /cannot transition from new to completed/i);
  assert.equal(harness.savedWorkOrders.length, 0);
});

test("terminal work orders cannot be reopened", async () => {
  const harness = createHarness({
    workOrder: makeWorkOrder({ status: "closed" }),
  });

  const result = await harness.service.transition({
    ...auditContext(),
    workOrderId: harness.workOrder.id,
    toStatus: "in_progress",
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /terminal/i);
});

test("quote-gated transitions require a current client-approved quote", async () => {
  const quote = makeQuote({ id: "quote-current", status: "ready_for_client" });
  const harness = createHarness({
    workOrder: makeWorkOrder({
      status: "pending_client_approval",
      currentQuoteId: quote.id,
    }),
    quotes: [quote],
  });

  const result = await harness.service.transition({
    ...auditContext(),
    workOrderId: harness.workOrder.id,
    toStatus: "approved_to_proceed",
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /client-approved current quote is required/i);
});

test("finance-state transitions require a current non-void invoice", async () => {
  const harness = createHarness({
    workOrder: makeWorkOrder({
      status: "completed",
      currentInvoiceId: "inv-old",
    }),
    invoices: [makeInvoice({ id: "inv-other", status: "draft" })],
  });

  const result = await harness.service.transition({
    ...auditContext(),
    workOrderId: harness.workOrder.id,
    toStatus: "invoiced",
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /current non-void invoice is required/i);
});

test("work order creation requires an existing location", async () => {
  const harness = createHarness({
    workOrder: makeWorkOrder(),
    clientLocationContextResult: serviceFail(
      notFoundError("Location could not be found."),
    ),
  });

  const result = await harness.service.create({
    ...auditContext(),
    title: "New request",
    description: "Check lobby lights",
    priority: "medium",
    clientOrganizationId: "client-1",
    locationId: "missing-location",
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /location could not be found/i);
  assert.equal(harness.createdWorkOrders.length, 0);
});

test("work order creation rejects inactive locations", async () => {
  const harness = createHarness({
    workOrder: makeWorkOrder(),
    clientLocationContextResult: serviceFail(
      validationError("Inactive locations cannot be used for new work orders."),
    ),
  });

  const result = await harness.service.create({
    ...auditContext(),
    title: "New request",
    description: "Check lobby lights",
    priority: "medium",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /inactive locations cannot be used/i);
  assert.equal(harness.createdWorkOrders.length, 0);
});

test("work order update rejects mismatched client organization and location", async () => {
  const harness = createHarness({
    workOrder: makeWorkOrder(),
    clientLocationContextResult: serviceFail(
      validationError(
        "Selected location does not belong to the specified client organization.",
      ),
    ),
  });

  const result = await harness.service.update({
    ...auditContext(),
    workOrderId: harness.workOrder.id,
    clientOrganizationId: "client-2",
    locationId: "loc-1",
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /does not belong to the specified client organization/i);
  assert.equal(harness.savedWorkOrders.length, 0);
});

test("work order creation rejects locations from a different top-level organization", async () => {
  const harness = createHarness({
    workOrder: makeWorkOrder(),
    clientLocationContextResult: serviceFail(
      notFoundError("Location could not be found."),
    ),
  });

  const result = await harness.service.create({
    ...auditContext(),
    title: "Cross-tenant request",
    description: "Should not be allowed",
    priority: "medium",
    clientOrganizationId: "client-1",
    locationId: "loc-other-org",
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /location could not be found/i);
  assert.equal(harness.createdWorkOrders.length, 0);
});

function createHarness(input: {
  workOrder: WorkOrder;
  quotes?: Quote[];
  invoices?: Invoice[];
  clientLocationContextResult?: {
    ok: true;
    value: {
      client: ClientOrganization;
      location: Location;
    };
  } | {
    ok: false;
    error: ReturnType<typeof validationError> | ReturnType<typeof notFoundError>;
  };
}) {
  const workOrderStore = new Map<EntityId, WorkOrder>([[input.workOrder.id, input.workOrder]]);
  const quoteStore = new Map<EntityId, Quote>(
    (input.quotes ?? []).map((quote) => [quote.id, quote]),
  );
  const invoiceStore = new Map<EntityId, Invoice>(
    (input.invoices ?? []).map((invoice) => [invoice.id, invoice]),
  );
  const savedWorkOrders: WorkOrder[] = [];
  const createdWorkOrders: WorkOrder[] = [];

  const workOrders: Pick<
    WorkOrderRepository,
    "create" | "getById" | "newId" | "save" | "listByOrganizationId"
    | "listByClientOrganizationId" | "listByLocationId"
    | "listByContractorOrganizationId"
  > = {
    newId() {
      return "wo-created-1";
    },
    async create(entity) {
      workOrderStore.set(entity.id, entity);
      createdWorkOrders.push(entity);
      return { id: entity.id, item: entity };
    },
    async getById(id) {
      return workOrderStore.get(id) ?? null;
    },
    async save(entity) {
      workOrderStore.set(entity.id, entity);
      savedWorkOrders.push(entity);
      return { id: entity.id, item: entity };
    },
    async listByOrganizationId() {
      return toListResult([...workOrderStore.values()]);
    },
    async listByClientOrganizationId() {
      return toListResult([...workOrderStore.values()]);
    },
    async listByLocationId() {
      return toListResult([...workOrderStore.values()]);
    },
    async listByContractorOrganizationId() {
      return toListResult(
        [...workOrderStore.values()].filter(
          (workOrder) => workOrder.assignedContractorOrganizationId === "contractor-1",
        ),
      );
    },
  };

  const quotes: Pick<QuoteRepository, "getById"> = {
    async getById(id) {
      return quoteStore.get(id) ?? null;
    },
  };

  const invoices: Pick<InvoiceRepository, "listByWorkOrderId"> = {
    async listByWorkOrderId(workOrderId) {
      return toListResult(
        [...invoiceStore.values()].filter((invoice) => invoice.workOrderId === workOrderId),
      );
    },
  };

  const activityLogs: ActivityLogService = {
    async listForWorkOrder() {
      return { ok: true, value: [] };
    },
    async record(input) {
      return {
        ok: true,
        value: {
          id: "activity-1",
          ...baseAuditFields(),
          workOrderId: input.workOrderId,
          action: input.action,
          eventType: input.eventType,
          message: input.message,
          actorType: "user",
          actorUserId: input.actor.userId,
          actorRole: input.actor.role,
          actor: {
            type: "user",
            userId: input.actor.userId,
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

  const clientLocations = {
    async getClientLocationContext() {
      return input.clientLocationContextResult ?? serviceOk({
        client: makeClientOrganization(),
        location: makeLocation(),
      });
    },
  } as unknown as ClientLocationService;

  return {
    createdWorkOrders,
    workOrder: input.workOrder,
    savedWorkOrders,
    service: createWorkOrderService(
      {
        workOrders: workOrders as WorkOrderRepository,
        quotes: quotes as QuoteRepository,
        invoices: invoices as InvoiceRepository,
        clientOrganizations: {} as ClientOrganizationRepository,
        locations: {} as LocationRepository,
        contractorOrganizations: {} as ContractorOrganizationRepository,
      },
      { activityLogs, clientLocations },
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
    title: "Leak repair",
    description: "Repair leak",
    status: "new",
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
    category: "Plumbing",
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
    status: "client_approved",
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

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    ...baseAuditFields(),
    id: "inv-1",
    workOrderId: "wo-1",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    invoiceNumber: "INV-1",
    status: "draft",
    issueDate: null,
    dueDate: "2026-04-30T00:00:00.000Z",
    paidDate: null,
    subtotalAmount: 100,
    taxAmount: 13,
    totalAmount: 113,
    currency: "CAD",
    lineItems: [
      {
        id: "line-1",
        description: "Repair",
        quantity: 1,
        unitPrice: 100,
        lineTotal: 100,
      },
    ],
    internalFinanceNotes: null,
    paymentReference: null,
    workOrderSnapshot: { id: "wo-1", name: "WO-1001" },
    clientSnapshot: { id: "client-1", name: "Client One" },
    locationSnapshot: { id: "loc-1", name: "HQ" },
    ...overrides,
  };
}

function makeClientOrganization(): ClientOrganization {
  return {
    ...baseAuditFields(),
    id: "client-1",
    name: "Client One",
    displayName: "Client One",
    status: "active",
    primaryContactName: null,
    primaryContactEmail: null,
    primaryContactPhone: null,
    billingEmail: null,
    notes: null,
  };
}

function makeLocation(): Location {
  return {
    id: "loc-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-11T00:00:00.000Z",
    updatedAt: "2026-04-11T00:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    deletedAt: null,
    deletedByUserId: null,
    clientOrganizationId: "client-1",
    name: "HQ",
    addressLine1: "123 Main St",
    addressLine2: null,
    city: "Toronto",
    region: "ON",
    postalCode: "M5H 1A1",
    countryCode: "CA",
    clientSnapshot: { id: "client-1", name: "Client One" },
    code: null,
    status: "active",
    locationContactName: null,
    locationContactEmail: null,
    locationContactPhone: null,
    accessNotes: null,
    notes: null,
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
