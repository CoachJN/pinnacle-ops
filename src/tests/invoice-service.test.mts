import assert from "node:assert/strict";
import test from "node:test";
import { createInvoiceService } from "../server/services/invoice-service.ts";
import type { ActivityLogService } from "../server/services/activity-log-service.ts";
import type {
  Invoice,
  InvoiceRepository,
  RepositoryListResult,
  WorkOrder,
  WorkOrderRepository,
} from "../server/repositories/index.ts";
import type { EntityId } from "../types/entity.ts";

test("invoice workflow creates a draft for a completed work order and tracks current invoice", async () => {
  const harness = createHarness({
    workOrder: makeWorkOrder({ status: "completed" }),
  });

  const result = await harness.service.create({
    ...auditContext(),
    workOrderId: harness.workOrder.id,
    dueDate: "2026-04-20T00:00:00.000Z",
    currency: "CAD",
    taxAmount: 15,
    notes: "Finance review ready",
    lineItems: [
      {
        id: "line-1",
        description: "Labor",
        quantity: 2,
        unitPrice: 100,
        lineTotal: 200,
      },
    ],
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.value.status, "draft");
  assert.equal(harness.workOrderStore.get(harness.workOrder.id)?.currentInvoiceId, result.value.id);
  assert.equal(harness.activityEvents.some((event) => event.eventType === "invoice_created"), true);
  assert.equal(harness.activityEvents.some((event) => event.action === "invoice.created"), true);
});

test("send invoice success moves the work order into invoiced and records finance activity", async () => {
  const invoice = makeInvoice({ status: "draft" });
  const workOrder = makeWorkOrder({
    status: "completed",
    currentInvoiceId: invoice.id,
  });
  const harness = createHarness({ workOrder, invoices: [invoice] });

  const result = await harness.service.sendInvoice({
    ...auditContext(),
    now: "2026-04-12T12:00:00.000Z",
    workOrderId: workOrder.id,
    invoiceId: invoice.id,
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.value.status, "sent");
  assert.equal(harness.workOrderStore.get(workOrder.id)?.status, "invoiced");
  assert.equal(
    harness.activityEvents.some((event) => event.eventType === "invoice_sent"),
    true,
  );
});

test("marking an invoice paid requires the work order to already be invoiced", async () => {
  const invoice = makeInvoice({ status: "sent" });
  const workOrder = makeWorkOrder({
    status: "completed",
    currentInvoiceId: invoice.id,
  });
  const harness = createHarness({ workOrder, invoices: [invoice] });

  const result = await harness.service.transition({
    ...auditContext(),
    now: "2026-04-12T12:00:00.000Z",
    workOrderId: workOrder.id,
    invoiceId: invoice.id,
    toStatus: "paid",
    paymentReference: "payment-123",
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /work order is invoiced/i);
});

test("invalid send with bad totals fails", async () => {
  const invoice = makeInvoice({
    status: "draft",
    subtotal: 999,
    totalAmount: 999,
  });
  const workOrder = makeWorkOrder({ status: "completed", currentInvoiceId: invoice.id });
  const harness = createHarness({ workOrder, invoices: [invoice] });

  const result = await harness.service.sendInvoice({
    ...auditContext(),
    now: "2026-04-12T12:00:00.000Z",
    workOrderId: workOrder.id,
    invoiceId: invoice.id,
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /totals are inconsistent/i);
});

test("finance queue returns overdue items first and supports status filtering", async () => {
  const harness = createHarness({
    workOrder: makeWorkOrder({ status: "invoiced", currentInvoiceId: "inv-overdue" }),
    invoices: [
      makeInvoice({
        id: "inv-draft",
        status: "draft",
        dueDate: "2026-04-25T00:00:00.000Z",
      }),
      makeInvoice({
        id: "inv-sent",
        status: "sent",
        dueDate: "2026-04-15T00:00:00.000Z",
      }),
      makeInvoice({
        id: "inv-overdue",
        status: "overdue",
        dueDate: "2026-04-10T00:00:00.000Z",
      }),
    ],
  });

  const queue = await harness.service.listFinanceQueue();
  assert.equal(queue.ok, true);
  if (!queue.ok) {
    return;
  }

  assert.deepEqual(
    queue.value.map((invoice) => invoice.id),
    ["inv-overdue", "inv-draft", "inv-sent"],
  );

  const filtered = await harness.service.listFinanceQueue({
    statuses: ["overdue"],
  });
  assert.equal(filtered.ok, true);
  if (!filtered.ok) {
    return;
  }

  assert.deepEqual(
    filtered.value.map((invoice) => invoice.id),
    ["inv-overdue"],
  );
});

test("invoice creation is blocked until the work order reaches completed", async () => {
  const harness = createHarness({
    workOrder: makeWorkOrder({ status: "in_progress" }),
  });

  const result = await harness.service.create({
    ...auditContext(),
    workOrderId: harness.workOrder.id,
    dueDate: "2026-04-20T00:00:00.000Z",
    currency: "CAD",
    taxAmount: 15,
    lineItems: [
      {
        id: "line-1",
        description: "Labor",
        quantity: 1,
        unitPrice: 100,
        lineTotal: 100,
      },
    ],
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /completed or ready for invoicing/i);
});

test("invoice creation is blocked when a work order already has an active invoice", async () => {
  const existingInvoice = makeInvoice({ status: "draft" });
  const harness = createHarness({
    workOrder: makeWorkOrder({
      status: "completed",
      currentInvoiceId: existingInvoice.id,
    }),
    invoices: [existingInvoice],
  });

  const result = await harness.service.create({
    ...auditContext(),
    workOrderId: harness.workOrder.id,
    dueDate: "2026-04-20T00:00:00.000Z",
    currency: "CAD",
    taxAmount: 15,
    lineItems: [
      {
        id: "line-1",
        description: "Labor",
        quantity: 1,
        unitPrice: 100,
        lineTotal: 100,
      },
    ],
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /already has an active invoice/i);
});

test("non-current invoices cannot be changed through finance actions", async () => {
  const currentInvoice = makeInvoice({ id: "inv-current", status: "draft" });
  const staleInvoice = makeInvoice({ id: "inv-stale", status: "draft" });
  const harness = createHarness({
    workOrder: makeWorkOrder({
      status: "completed",
      currentInvoiceId: currentInvoice.id,
    }),
    invoices: [currentInvoice, staleInvoice],
  });

  const result = await harness.service.transition({
    ...auditContext(),
    now: "2026-04-12T12:00:00.000Z",
    workOrderId: harness.workOrder.id,
    invoiceId: staleInvoice.id,
    toStatus: "sent",
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /current invoice can be changed/i);
});

test("paid invoices remain terminal for subsequent finance transitions", async () => {
  const invoice = makeInvoice({ status: "paid" });
  const harness = createHarness({
    workOrder: makeWorkOrder({
      status: "paid",
      currentInvoiceId: invoice.id,
    }),
    invoices: [invoice],
  });

  const result = await harness.service.transition({
    ...auditContext(),
    now: "2026-04-12T12:00:00.000Z",
    workOrderId: harness.workOrder.id,
    invoiceId: invoice.id,
    toStatus: "void",
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /terminal/i);
});

test("mark paid success records payment reference and advances work order", async () => {
  const invoice = makeInvoice({ status: "sent" });
  const workOrder = makeWorkOrder({
    status: "invoiced",
    currentInvoiceId: invoice.id,
  });
  const harness = createHarness({ workOrder, invoices: [invoice] });

  const result = await harness.service.markInvoicePaid({
    ...auditContext(),
    now: "2026-04-12T12:00:00.000Z",
    workOrderId: workOrder.id,
    invoiceId: invoice.id,
    paymentReference: "payment-123",
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.value.status, "paid");
  assert.equal(result.value.paymentReference, "payment-123");
  assert.equal(harness.workOrderStore.get(workOrder.id)?.status, "paid");
});

test("overdue transition success from viewed invoice", async () => {
  const invoice = makeInvoice({
    status: "viewed",
    dueDate: "2026-04-10T00:00:00.000Z",
  });
  const workOrder = makeWorkOrder({
    status: "invoiced",
    currentInvoiceId: invoice.id,
  });
  const harness = createHarness({ workOrder, invoices: [invoice] });

  const result = await harness.service.markInvoiceOverdue({
    ...auditContext(),
    now: "2026-04-12T12:00:00.000Z",
    workOrderId: workOrder.id,
    invoiceId: invoice.id,
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.value.status, "overdue");
});

test("void invoice success returns work order to ready for invoicing", async () => {
  const invoice = makeInvoice({ status: "sent" });
  const workOrder = makeWorkOrder({
    status: "invoiced",
    currentInvoiceId: invoice.id,
  });
  const harness = createHarness({ workOrder, invoices: [invoice] });

  const result = await harness.service.voidInvoice({
    ...auditContext(),
    now: "2026-04-12T12:00:00.000Z",
    workOrderId: workOrder.id,
    invoiceId: invoice.id,
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    return;
  }

  assert.equal(result.value.status, "void");
  assert.equal(harness.workOrderStore.get(workOrder.id)?.status, "ready_for_invoicing");
});

test("invalid transition from paid to sent fails", async () => {
  const invoice = makeInvoice({ status: "paid", paidAt: "2026-04-10T00:00:00.000Z" });
  const workOrder = makeWorkOrder({
    status: "paid",
    currentInvoiceId: invoice.id,
  });
  const harness = createHarness({ workOrder, invoices: [invoice] });

  const result = await harness.service.transition({
    ...auditContext(),
    now: "2026-04-12T12:00:00.000Z",
    workOrderId: workOrder.id,
    invoiceId: invoice.id,
    toStatus: "sent",
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    return;
  }

  assert.match(result.error.message, /terminal/i);
});

function createHarness(input: {
  workOrder: WorkOrder;
  invoices?: Invoice[];
}) {
  const workOrderStore = new Map<EntityId, WorkOrder>([[input.workOrder.id, input.workOrder]]);
  const invoiceStore = new Map<EntityId, Invoice>(
    (input.invoices ?? []).map((invoice) => [invoice.id, invoice]),
  );
  const activityEvents: Array<{ eventType: string; action: string; message: string }> = [];

  const workOrders: Pick<WorkOrderRepository, "getById" | "save"> = {
    async getById(id) {
      return workOrderStore.get(id) ?? null;
    },
    async save(entity) {
      workOrderStore.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
  };

  const invoices: Pick<
    InvoiceRepository,
    "newId" | "getById" | "create" | "save" | "listByWorkOrderId" | "listFinanceQueue"
  > = {
    newId() {
      return "inv-created";
    },
    async getById(id) {
      return invoiceStore.get(id) ?? null;
    },
    async create(entity) {
      invoiceStore.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
    async save(entity) {
      invoiceStore.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
    async listByWorkOrderId(workOrderId) {
      return toListResult(
        [...invoiceStore.values()].filter((invoice) => invoice.workOrderId === workOrderId),
      );
    },
    async listFinanceQueue() {
      return toListResult(
        [...invoiceStore.values()].filter((invoice) =>
          ["draft", "sent", "viewed", "overdue", "paid"].includes(invoice.status),
        ),
      );
    },
  };

  const activityLogs: ActivityLogService = {
    async listForWorkOrder() {
      return { ok: true, value: [] };
    },
    async record(input) {
      activityEvents.push({
        eventType: input.eventType,
        action: input.action,
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
          actorUserId: input.actor.userId,
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
    activityEvents,
    service: createInvoiceService(
      {
        workOrders: workOrders as WorkOrderRepository,
        invoices: invoices as InvoiceRepository,
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
    title: "Leak repair",
    description: "Repair ceiling leak",
    status: "completed",
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
    locationSnapshot: {
      id: "loc-1",
      name: "HQ",
      addressText: "123 Main St",
    },
    contractorSnapshot: null,
    category: "plumbing",
    requestedServiceDate: null,
    submittedAt: null,
    approvedAt: null,
    completedAt: "2026-04-10T00:00:00.000Z",
    closedAt: null,
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
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
    invoiceNumber: "INV-1001",
    status: "draft",
    issuedDate: null,
    dueDate: "2026-04-20T00:00:00.000Z",
    sentAt: null,
    viewedAt: null,
    paidAt: null,
    voidedAt: null,
    subtotal: 200,
    taxAmount: 20,
    totalAmount: 220,
    currency: "CAD",
    lineItems: [
      {
        id: "line-1",
        description: "Labor",
        quantity: 2,
        unitPrice: 100,
        lineTotal: 200,
      },
    ],
    notes: null,
    paymentReference: null,
    qboInvoiceId: null,
    qboSyncStatus: null,
    workOrderSnapshot: { id: "wo-1", name: "WO-1001" },
    clientSnapshot: { id: "client-1", name: "Client One" },
    locationSnapshot: { id: "loc-1", name: "HQ" },
    ...overrides,
  };
}

function auditContext() {
  return {
    organizationId: "org-1",
    actor: {
      userId: "finance-1",
      role: "finance_admin" as const,
    },
  };
}

function toListResult<T>(items: T[]): RepositoryListResult<T> {
  return {
    items,
    count: items.length,
  };
}

function baseAuditFields() {
  return {
    organizationId: "org-1",
    recordStatus: "active" as const,
    isDeleted: false,
    createdAt: "2026-04-11T00:00:00.000Z",
    updatedAt: "2026-04-11T00:00:00.000Z",
    createdByUserId: "finance-1",
    updatedByUserId: "finance-1",
    deletedAt: null,
    deletedByUserId: null,
  };
}
