import assert from "node:assert/strict";
import test from "node:test";

import { createQuoteWorkflowService } from "../server/services/quote-workflow-service.ts";
import type { ActivityLogService } from "../server/services/activity-log-service.ts";
import type {
  ClientQuote,
  ClientQuoteRepository,
  ContractorQuote,
  ContractorQuoteRepository,
  RepositoryListResult,
  WorkOrder,
  WorkOrderRepository,
} from "../server/repositories/index.ts";
import { USER_ROLES } from "../types/permissions.ts";
import type { EntityId } from "../types/entity.ts";

test("contractor quote submit success", async () => {
  const harness = createHarness();

  const result = await harness.service.submitContractorQuote({
    ...auditContext(USER_ROLES.ContractorUser, "contractor-user-1"),
    workOrderId: harness.workOrder.id,
    contractorOrganizationId: "contractor-1",
    lineItems: [lineItem()],
    subtotal: 100,
    taxAmount: 0,
    totalAmount: 100,
    notes: "Need replacement parts.",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.status, "submitted");
  assert.equal(harness.workOrderStore.get(harness.workOrder.id)?.status, "quote_received");
});

test("contractor quote invalid totals failure", async () => {
  const harness = createHarness();

  const result = await harness.service.submitContractorQuote({
    ...auditContext(USER_ROLES.ContractorUser, "contractor-user-1"),
    workOrderId: harness.workOrder.id,
    contractorOrganizationId: "contractor-1",
    lineItems: [lineItem()],
    subtotal: 90,
    taxAmount: 0,
    totalAmount: 90,
    notes: "Bad totals",
  });

  assert.equal(result.ok, false);
});

test("unauthorized contractor edit failure", async () => {
  const harness = createHarness({
    workOrder: makeWorkOrder({ assignedContractorOrganizationId: "contractor-2" }),
  });

  const result = await harness.service.saveContractorQuoteDraft({
    ...auditContext(USER_ROLES.ContractorUser, "contractor-user-1"),
    workOrderId: harness.workOrder.id,
    contractorOrganizationId: "contractor-1",
    lineItems: [lineItem()],
    subtotal: 100,
    taxAmount: 0,
    totalAmount: 100,
  });

  assert.equal(result.ok, false);
});

test("manager accept contractor quote", async () => {
  const contractorQuote = makeContractorQuote({ status: "submitted" });
  const harness = createHarness({ contractorQuotes: [contractorQuote] });

  const result = await harness.service.reviewContractorQuote({
    ...auditContext(USER_ROLES.Manager, "manager-1"),
    workOrderId: harness.workOrder.id,
    contractorQuoteId: contractorQuote.id,
    action: "accept_contractor_quote",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.status, "accepted");
});

test("manager reject contractor quote", async () => {
  const contractorQuote = makeContractorQuote({ status: "submitted" });
  const harness = createHarness({ contractorQuotes: [contractorQuote] });

  const result = await harness.service.reviewContractorQuote({
    ...auditContext(USER_ROLES.Manager, "manager-1"),
    workOrderId: harness.workOrder.id,
    contractorQuoteId: contractorQuote.id,
    action: "reject_contractor_quote",
    rejectionReason: "Need scope detail.",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.status, "rejected");
});

test("create client quote from approved contractor quote", async () => {
  const contractorQuote = makeContractorQuote({ status: "accepted" });
  const harness = createHarness({ contractorQuotes: [contractorQuote] });

  const result = await harness.service.createClientQuoteFromContractorQuote({
    ...auditContext(USER_ROLES.Manager, "manager-1"),
    workOrderId: harness.workOrder.id,
    contractorQuoteId: contractorQuote.id,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.sourceContractorQuoteId, contractorQuote.id);
  assert.equal(harness.workOrderStore.get(harness.workOrder.id)?.currentQuoteId, result.value.id);
});

test("send client quote success", async () => {
  const clientQuote = makeClientQuote({ status: "draft" });
  const harness = createHarness({ clientQuotes: [clientQuote] });

  const result = await harness.service.sendClientQuote({
    ...auditContext(USER_ROLES.Manager, "manager-1"),
    workOrderId: harness.workOrder.id,
    clientQuoteId: clientQuote.id,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.status, "sent");
  assert.equal(harness.workOrderStore.get(harness.workOrder.id)?.status, "pending_client_approval");
});

test("invalid client quote approval before sent failure", async () => {
  const clientQuote = makeClientQuote({ status: "draft" });
  const harness = createHarness({ clientQuotes: [clientQuote] });

  const result = await harness.service.approveClientQuote({
    ...auditContext(USER_ROLES.Manager, "manager-1"),
    workOrderId: harness.workOrder.id,
    clientQuoteId: clientQuote.id,
  });

  assert.equal(result.ok, false);
});

test("valid client quote approval success", async () => {
  const clientQuote = makeClientQuote({ status: "sent" });
  const harness = createHarness({ clientQuotes: [clientQuote] });

  const result = await harness.service.approveClientQuote({
    ...auditContext(USER_ROLES.Manager, "manager-1"),
    workOrderId: harness.workOrder.id,
    clientQuoteId: clientQuote.id,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.status, "approved");
  assert.equal(harness.workOrderStore.get(harness.workOrder.id)?.status, "approved_to_proceed");
});

test("client user can approve their sent quote", async () => {
  const clientQuote = makeClientQuote({ status: "sent" });
  const harness = createHarness({ clientQuotes: [clientQuote] });

  const result = await harness.service.approveClientQuote({
    ...auditContext(USER_ROLES.ClientUser, "client-user-1"),
    workOrderId: harness.workOrder.id,
    clientQuoteId: clientQuote.id,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.status, "approved");
});

test("client user can reject their sent quote", async () => {
  const clientQuote = makeClientQuote({ status: "sent" });
  const harness = createHarness({
    workOrder: makeWorkOrder({ status: "pending_client_approval" }),
    clientQuotes: [clientQuote],
  });

  const result = await harness.service.rejectClientQuote({
    ...auditContext(USER_ROLES.ClientUser, "client-user-1"),
    workOrderId: harness.workOrder.id,
    clientQuoteId: clientQuote.id,
    rejectionReason: "Please revise the scope.",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.status, "rejected");
});

test("enforcement of one active client quote", async () => {
  const clientQuote = makeClientQuote({ status: "draft" });
  const harness = createHarness({ clientQuotes: [clientQuote] });

  const result = await harness.service.createManualClientQuote({
    ...auditContext(USER_ROLES.Manager, "manager-1"),
    workOrderId: harness.workOrder.id,
    lineItems: [lineItem()],
    subtotal: 100,
    taxAmount: 0,
    totalAmount: 100,
  });

  assert.equal(result.ok, false);
});

test("coordinator cannot approve client quote", async () => {
  const clientQuote = makeClientQuote({ status: "sent" });
  const harness = createHarness({ clientQuotes: [clientQuote] });

  const result = await harness.service.approveClientQuote({
    ...auditContext(USER_ROLES.Coordinator, "coord-1"),
    workOrderId: harness.workOrder.id,
    clientQuoteId: clientQuote.id,
  });

  assert.equal(result.ok, false);
});

test("coordinator cannot create manual client quote", async () => {
  const harness = createHarness();

  const result = await harness.service.createManualClientQuote({
    ...auditContext(USER_ROLES.Coordinator, "coord-1"),
    workOrderId: harness.workOrder.id,
    lineItems: [lineItem()],
    subtotal: 100,
    taxAmount: 0,
    totalAmount: 100,
  });

  assert.equal(result.ok, false);
});

test("client quote rejection returns work order to quote requested", async () => {
  const clientQuote = makeClientQuote({ status: "sent" });
  const harness = createHarness({
    workOrder: makeWorkOrder({ status: "pending_client_approval" }),
    clientQuotes: [clientQuote],
  });

  const result = await harness.service.rejectClientQuote({
    ...auditContext(USER_ROLES.Manager, "manager-1"),
    workOrderId: harness.workOrder.id,
    clientQuoteId: clientQuote.id,
    rejectionReason: "Client declined scope.",
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.status, "rejected");
  assert.equal(harness.workOrderStore.get(harness.workOrder.id)?.status, "quote_requested");
});

function createHarness(input: {
  workOrder?: WorkOrder;
  contractorQuotes?: ContractorQuote[];
  clientQuotes?: ClientQuote[];
} = {}) {
  const workOrder = input.workOrder ?? makeWorkOrder();
  const workOrderStore = new Map<EntityId, WorkOrder>([[workOrder.id, workOrder]]);
  const contractorQuoteStore = new Map<EntityId, ContractorQuote>(
    (input.contractorQuotes ?? []).map((quote) => [quote.id, quote]),
  );
  const clientQuoteStore = new Map<EntityId, ClientQuote>(
    (input.clientQuotes ?? []).map((quote) => [quote.id, quote]),
  );

  const workOrders: Pick<WorkOrderRepository, "getById" | "save"> = {
    async getById(id) {
      return workOrderStore.get(id) ?? null;
    },
    async save(entity) {
      workOrderStore.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
  };

  const contractorQuotes: Pick<
    ContractorQuoteRepository,
    "newId" | "getById" | "create" | "save" | "listByWorkOrderId" | "listPendingReview"
  > = {
    newId() {
      return "contractor-quote-new";
    },
    async getById(id) {
      return contractorQuoteStore.get(id) ?? null;
    },
    async create(entity) {
      contractorQuoteStore.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      contractorQuoteStore.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
    async listByWorkOrderId(workOrderId) {
      return toListResult(
        [...contractorQuoteStore.values()].filter((quote) => quote.workOrderId === workOrderId),
      );
    },
    async listPendingReview() {
      return toListResult([...contractorQuoteStore.values()]);
    },
  };

  const clientQuotes: Pick<
    ClientQuoteRepository,
    "newId" | "getById" | "create" | "save" | "listByWorkOrderId" | "getActiveByWorkOrderId"
  > = {
    newId() {
      return "client-quote-new";
    },
    async getById(id) {
      return clientQuoteStore.get(id) ?? null;
    },
    async create(entity) {
      clientQuoteStore.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      clientQuoteStore.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
    async listByWorkOrderId(workOrderId) {
      return toListResult(
        [...clientQuoteStore.values()].filter((quote) => quote.workOrderId === workOrderId),
      );
    },
    async getActiveByWorkOrderId(workOrderId) {
      return [...clientQuoteStore.values()].find(
        (quote) =>
          quote.workOrderId === workOrderId &&
          (quote.status === "draft" || quote.status === "sent"),
      ) ?? null;
    },
  };

  const activityLogs: ActivityLogService = {
    async listForWorkOrder() {
      return { ok: true, value: [] };
    },
    async record() {
      return { ok: true, value: null as never };
    },
  };

  return {
    workOrder,
    workOrderStore,
    service: createQuoteWorkflowService(
      {
        workOrders: workOrders as WorkOrderRepository,
        contractorQuotes: contractorQuotes as ContractorQuoteRepository,
        clientQuotes: clientQuotes as ClientQuoteRepository,
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
    createdAt: "2026-04-14T10:00:00.000Z",
    updatedAt: "2026-04-14T10:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderNumber: "WO-1001",
    title: "Roof repair",
    description: "Repair membrane and flashing.",
    status: "quote_requested",
    priority: "medium",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    requestedByUserId: "user-1",
    assignedCoordinatorUserId: "coord-1",
    assignedManagerUserId: "mgr-1",
    assignedContractorOrganizationId: "contractor-1",
    currentQuoteId: null,
    currentInvoiceId: null,
    clientSnapshot: { id: "client-1", name: "Client" },
    locationSnapshot: { id: "loc-1", name: "Location", addressText: null },
    contractorSnapshot: { id: "contractor-1", name: "Contractor" },
    category: null,
    requestedServiceDate: null,
    submittedAt: null,
    approvedAt: null,
    completedAt: null,
    closedAt: null,
    ...overrides,
  };
}

function makeContractorQuote(
  overrides: Partial<ContractorQuote> = {},
): ContractorQuote {
  return {
    id: "contractor-quote-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-14T10:00:00.000Z",
    updatedAt: "2026-04-14T10:00:00.000Z",
    createdByUserId: "contractor-user-1",
    updatedByUserId: "contractor-user-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderId: "wo-1",
    contractorUserId: "contractor-user-1",
    contractorOrganizationId: "contractor-1",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    lineItems: [lineItem()],
    subtotal: 100,
    taxAmount: 0,
    totalAmount: 100,
    notes: null,
    status: "draft",
    submittedAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    rejectionReason: null,
    workOrderSnapshot: { id: "wo-1", name: "WO-1001" },
    contractorSnapshot: { id: "contractor-1", name: "Contractor" },
    ...overrides,
  };
}

function makeClientQuote(overrides: Partial<ClientQuote> = {}): ClientQuote {
  return {
    id: "client-quote-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-14T10:00:00.000Z",
    updatedAt: "2026-04-14T10:00:00.000Z",
    createdByUserId: "manager-1",
    updatedByUserId: "manager-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderId: "wo-1",
    sourceContractorQuoteId: null,
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    lineItems: [lineItem()],
    subtotal: 100,
    taxAmount: 0,
    totalAmount: 100,
    notes: null,
    status: "draft",
    sentAt: null,
    respondedAt: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    workOrderSnapshot: { id: "wo-1", name: "WO-1001" },
    ...overrides,
  };
}

function lineItem() {
  return {
    description: "Labor",
    quantity: 1,
    unitPrice: 100,
    lineTotal: 100,
  };
}

function auditContext(role: typeof USER_ROLES[keyof typeof USER_ROLES], userId: string) {
  return {
    organizationId: "org-1",
    actor: {
      userId,
      role,
    },
  };
}

function toListResult<T>(items: T[]): RepositoryListResult<T> {
  return { items, count: items.length };
}
