import assert from "node:assert/strict";
import test from "node:test";

import { buildFinanceQueue } from "../modules/finance/index.ts";
import { buildDashboardData } from "../modules/dashboard/index.ts";
import { APP_ROLES } from "../lib/rbac/roles.ts";
import type { Assignment, WorkOrder } from "../server/repositories/index.ts";
import type { OperationalAlertItem } from "../modules/notifications/index.ts";

test("coordinator dashboard emphasizes dispatch and quote queues without finance exposure", () => {
  const workOrders = [
    makeWorkOrder({
      id: "wo-ready",
      workOrderNumber: "WO-READY",
      status: "approved_to_proceed",
      updatedAt: "2026-04-13T00:00:00.000Z",
    }),
    makeWorkOrder({
      id: "wo-quote",
      workOrderNumber: "WO-QUOTE",
      status: "quote_received",
      updatedAt: "2026-04-12T00:00:00.000Z",
    }),
    makeWorkOrder({
      id: "wo-client",
      workOrderNumber: "WO-CLIENT",
      status: "pending_client_approval",
      updatedAt: "2026-04-11T00:00:00.000Z",
    }),
  ];

  const dashboard = buildDashboardData({
    role: APP_ROLES.Coordinator,
    alerts: [makeAlert()],
    workOrders,
    activeAssignmentsByWorkOrderId: new Map<string, Assignment | null>(),
    now: "2026-04-14T00:00:00.000Z",
  });

  assert.equal(dashboard.visibility.showFinanceAttention, false);
  assert.equal(dashboard.summaryCounts.awaitingAssignment, 1);
  assert.equal(dashboard.summaryCounts.awaitingQuoteReview, 1);
  assert.equal(dashboard.summaryCounts.awaitingClientAction, 1);
  assert.equal(dashboard.summaryCounts.readyForInvoicing, 0);
  assert.equal(dashboard.queueSections.dispatchAttention.items.length, 1);
  assert.equal(dashboard.queueSections.quoteBottlenecks.items.length, 2);
});

test("finance admin dashboard reuses canonical finance queue shaping", () => {
  const workOrders = [
    makeWorkOrder({
      id: "wo-ready",
      workOrderNumber: "WO-READY",
      status: "completed",
      currentInvoiceId: null,
      completedAt: "2026-04-10T00:00:00.000Z",
      updatedAt: "2026-04-10T00:00:00.000Z",
    }),
    makeWorkOrder({
      id: "wo-overdue",
      workOrderNumber: "WO-OVERDUE",
      status: "invoiced",
      currentInvoiceId: "inv-overdue",
      completedAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-12T00:00:00.000Z",
    }),
  ];

  const financeQueueItems = buildFinanceQueue({
    workOrders: workOrders.map((workOrder) => ({
      id: workOrder.id,
      workOrderNumber: workOrder.workOrderNumber,
      title: workOrder.title,
      status: workOrder.status,
      priority: workOrder.priority,
      clientOrganizationId: workOrder.clientOrganizationId,
      locationId: workOrder.locationId,
      currentInvoiceId: workOrder.currentInvoiceId,
      clientSnapshot: workOrder.clientSnapshot,
      locationSnapshot: workOrder.locationSnapshot,
      completedAt: workOrder.completedAt,
      updatedAt: workOrder.updatedAt,
    })),
    invoices: [
      {
        id: "inv-overdue",
        workOrderId: "wo-overdue",
        invoiceNumber: "INV-OVERDUE",
        status: "overdue",
        dueDate: "2026-04-05T00:00:00.000Z",
        totalAmount: 250,
        currency: "CAD",
        sentAt: "2026-04-01T00:00:00.000Z",
        viewedAt: "2026-04-02T00:00:00.000Z",
        paidAt: null,
        updatedAt: "2026-04-12T00:00:00.000Z",
      },
    ],
  });

  const dashboard = buildDashboardData({
    role: APP_ROLES.FinanceAdmin,
    alerts: [],
    workOrders,
    activeAssignmentsByWorkOrderId: new Map<string, Assignment | null>(),
    financeQueueItems,
    now: "2026-04-14T00:00:00.000Z",
  });

  assert.equal(dashboard.visibility.financeFirst, true);
  assert.equal(dashboard.visibility.showDispatchAttention, false);
  assert.equal(dashboard.summaryCounts.readyForInvoicing, 1);
  assert.equal(dashboard.summaryCounts.overdueInvoices, 1);
  assert.deepEqual(
    dashboard.queueSections.financeAttention.items.map((item) => item.state),
    ["ready_for_invoicing", "overdue"],
  );
});

test("owner dashboard surfaces at-risk work from stale work orders, overdue invoices, and alerts", () => {
  const staleUpdatedAt = "2026-04-01T00:00:00.000Z";
  const workOrders = [
    makeWorkOrder({
      id: "wo-stale",
      workOrderNumber: "WO-STALE",
      status: "dispatched",
      updatedAt: staleUpdatedAt,
    }),
  ];

  const dashboard = buildDashboardData({
    role: APP_ROLES.Owner,
    alerts: [
      makeAlert({
        id: "alert-risk",
        title: "Invoice overdue",
        state: "sla_breached",
        createdAt: "2026-04-14T00:00:00.000Z",
        targetPath: "/finance",
      }),
    ],
    workOrders,
    activeAssignmentsByWorkOrderId: new Map<string, Assignment | null>([
      [
        "wo-stale",
        makeAssignment({
          workOrderId: "wo-stale",
          status: "assigned",
        }),
      ],
    ]),
    financeQueueItems: buildFinanceQueue({
      workOrders: [
        {
          id: "wo-finance",
          workOrderNumber: "WO-FIN",
          title: "Collections follow-up",
          status: "invoiced",
          priority: "high",
          clientOrganizationId: "client-1",
          locationId: "loc-1",
          currentInvoiceId: "inv-overdue",
          clientSnapshot: { id: "client-1", name: "Northstar" },
          locationSnapshot: { id: "loc-1", name: "Pinnacle Tower" },
          completedAt: "2026-04-01T00:00:00.000Z",
          updatedAt: "2026-04-12T00:00:00.000Z",
        },
      ],
      invoices: [
        {
          id: "inv-overdue",
          workOrderId: "wo-finance",
          invoiceNumber: "INV-OVERDUE",
          status: "overdue",
          dueDate: "2026-04-05T00:00:00.000Z",
          totalAmount: 250,
          currency: "CAD",
          sentAt: "2026-04-01T00:00:00.000Z",
          viewedAt: "2026-04-02T00:00:00.000Z",
          paidAt: null,
          updatedAt: "2026-04-12T00:00:00.000Z",
        },
      ],
    }),
    now: "2026-04-14T00:00:00.000Z",
  });

  assert.equal(dashboard.queueSections.atRiskItems.items.length, 3);
  assert.equal(
    dashboard.queueSections.atRiskItems.items.some((item) => item.kind === "work_order"),
    true,
  );
  assert.equal(
    dashboard.queueSections.atRiskItems.items.some((item) => item.kind === "invoice"),
    true,
  );
  assert.equal(
    dashboard.queueSections.atRiskItems.items.some((item) => item.kind === "alert"),
    true,
  );
});

function makeWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: "wo-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-02T00:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    workOrderNumber: "WO-1",
    title: "Repair leak",
    description: "Fix the leak",
    status: "new",
    priority: "medium",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    requestedByUserId: "user-1",
    assignedCoordinatorUserId: "coord-1",
    assignedManagerUserId: "manager-1",
    assignedContractorOrganizationId: null,
    currentQuoteId: null,
    currentInvoiceId: null,
    clientSnapshot: { id: "client-1", name: "Northstar" },
    locationSnapshot: {
      id: "loc-1",
      name: "Pinnacle Tower",
      addressText: null,
    },
    contractorSnapshot: null,
    category: "plumbing",
    requestedServiceDate: null,
    submittedAt: null,
    approvedAt: null,
    completedAt: null,
    closedAt: null,
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: "assignment-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    workOrderId: "wo-1",
    contractorOrganizationId: "contractor-1",
    assigneeType: "contractor",
    assigneeUserId: "contractor-user-1",
    assigneeOrganizationId: "contractor-1",
    assignedByUserId: "user-1",
    status: "assigned",
    scheduledDate: null,
    timeWindowStart: null,
    timeWindowEnd: null,
    assignedAt: "2026-04-10T00:00:00.000Z",
    acceptedAt: null,
    declinedAt: null,
    completedAt: null,
    notes: null,
    workOrderSnapshot: { id: "wo-1", name: "WO-1" },
    contractorSnapshot: { id: "contractor-1", name: "North Peak" },
    ...overrides,
  };
}

function makeAlert(
  overrides: Partial<OperationalAlertItem> = {},
): OperationalAlertItem {
  return {
    id: "alert-1",
    eventType: "quote_awaiting_manager_review",
    title: "Quote awaiting review",
    message: "A quote needs review.",
    severity: "normal",
    state: "active",
    actorDisplayName: "Casey Coordinator",
    entityType: "quote",
    entityId: "quote-1",
    workOrderId: "wo-1",
    recipientRole: "manager",
    targetPath: "/dashboard/work-orders/wo-1",
    dueAt: null,
    createdAt: "2026-04-14T00:00:00.000Z",
    ...overrides,
  };
}
