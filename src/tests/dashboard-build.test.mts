import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { buildDashboardData } from "../modules/dashboard/server/build-dashboard.ts";
import type { WorkOrder } from "../server/repositories/index.ts";

describe("buildDashboardData", () => {
  test("renders at-risk work orders with a fallback label when lifecycle status is missing", () => {
    const dashboard = buildDashboardData({
      role: "manager",
      alerts: [],
      workOrders: [makeWorkOrder({ lifecycleStatus: undefined })],
      activeAssignmentsByWorkOrderId: new Map(),
      financeQueueItems: [],
      now: "2026-05-06T12:00:00.000Z",
    });

    assert.equal(dashboard.queueSections.atRiskItems.items.length, 1);
    assert.equal(
      dashboard.queueSections.atRiskItems.items[0]?.description,
      "Work order has been idle for 5 days in an unknown status.",
    );
  });
});

function makeWorkOrder(
  overrides: Partial<WorkOrder> & { lifecycleStatus?: WorkOrder["lifecycleStatus"] | undefined },
): WorkOrder {
  return {
    id: "wo-1",
    organizationId: "org-1",
    createdAt: "2026-05-01T09:00:00.000Z",
    updatedAt: "2026-05-01T12:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    recordStatus: "active",
    isDeleted: false,
    deletedAt: null,
    deletedByUserId: null,
    workOrderNumber: "WO-1001",
    title: "Leaking sink",
    description: "Repair the sink in suite 200.",
    lifecycleStatus: "triage",
    status: "triage",
    priority: "medium",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    requestedByContactId: null,
    coordinatorUserId: null,
    managerUserId: null,
    currentQuoteId: null,
    currentInvoiceId: null,
    clientSnapshot: { id: "client-1", name: "Acme" },
    locationSnapshot: { id: "loc-1", name: "HQ", addressText: null },
    contractorSnapshot: null,
    closedAt: null,
    ...overrides,
    status: overrides.lifecycleStatus ?? "triage",
  } as WorkOrder;
}
