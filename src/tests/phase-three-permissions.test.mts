import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  canCancelWorkOrder,
  canCloseWorkOrder,
  canCreateClient,
  canCreateLocation,
  canCreateWorkOrder,
  canEditClient,
  canEditLocation,
  canEditWorkOrder,
  canTransitionWorkOrder,
} from "../lib/permissions/index.ts";
import { getDashboardDataForRole } from "../lib/dashboard/work-order-dashboard-data.ts";
import { parseInternalRole } from "../lib/permissions/roles.ts";
import { USER_ROLES } from "../types/permissions.ts";
import type { Invoice } from "../types/invoice.ts";
import type { PhaseOneWorkOrder } from "../types/work-order.ts";

describe("phase 3 internal role permissions", () => {
  test("external roles do not fall through to coordinator in internal mock context", () => {
    assert.equal(parseInternalRole(undefined), USER_ROLES.Coordinator);
    assert.throws(
      () => parseInternalRole(USER_ROLES.ContractorUser),
      /Invalid internal role/,
    );
  });

  test("finance/admin can close paid work orders but cannot run intake edits", () => {
    const paid = makeWorkOrder({
      status: "paid",
      currentInvoiceId: "inv-1",
    });
    const paidInvoice = makeInvoice({ id: "inv-1", status: "paid" });

    assert.equal(
      canCloseWorkOrder(USER_ROLES.FinanceAdmin, paid, paidInvoice),
      true,
    );
    assert.equal(
      canTransitionWorkOrder(USER_ROLES.FinanceAdmin, paid, "closed", {
        currentInvoice: paidInvoice,
      }),
      true,
    );
    assert.equal(canCreateWorkOrder(USER_ROLES.FinanceAdmin), false);
    assert.equal(canEditWorkOrder(USER_ROLES.FinanceAdmin, paid), false);
    assert.equal(canCreateClient(USER_ROLES.FinanceAdmin), false);
    assert.equal(canEditClient(USER_ROLES.FinanceAdmin), false);
    assert.equal(canCreateLocation(USER_ROLES.FinanceAdmin), false);
    assert.equal(canEditLocation(USER_ROLES.FinanceAdmin), false);
  });

  test("coordinator can run operational actions but cannot close completed work orders", () => {
    const newWorkOrder = makeWorkOrder({ status: "new" });
    const completed = makeWorkOrder({ status: "completed" });

    assert.equal(canCreateWorkOrder(USER_ROLES.Coordinator), true);
    assert.equal(canEditWorkOrder(USER_ROLES.Coordinator, newWorkOrder), true);
    assert.equal(
      canTransitionWorkOrder(USER_ROLES.Coordinator, newWorkOrder, "in_review"),
      true,
    );
    assert.equal(canCancelWorkOrder(USER_ROLES.Coordinator, newWorkOrder), true);
    assert.equal(canCloseWorkOrder(USER_ROLES.Coordinator, completed), false);
  });

  test("terminal work orders are not operationally editable", () => {
    const closed = makeWorkOrder({ status: "closed" });
    const cancelled = makeWorkOrder({ status: "cancelled" });

    assert.equal(canEditWorkOrder(USER_ROLES.Owner, closed), false);
    assert.equal(canEditWorkOrder(USER_ROLES.Manager, cancelled), false);
    assert.equal(canCancelWorkOrder(USER_ROLES.Owner, closed), false);
  });
});

describe("phase 3 role dashboard data", () => {
  test("coordinator dashboard emphasizes intake and active operational queues", () => {
    const dashboard = getDashboardDataForRole(USER_ROLES.Coordinator, [
      makeWorkOrder({ id: "wo-new", status: "new" }),
      makeWorkOrder({ id: "wo-progress", status: "in_progress" }),
      makeWorkOrder({ id: "wo-closed", status: "closed" }),
    ]);

    assert.equal(dashboard.eyebrow, "Coordinator dashboard");
    assert.equal(
      dashboard.queues.find((queue) => queue.title === "Needs intake attention")
        ?.items.length,
      1,
    );
    assert.equal(
      dashboard.queues.find((queue) => queue.title === "Active operational work")
        ?.items.length,
      1,
    );
  });

  test("finance/admin dashboard emphasizes ready-to-close work", () => {
    const dashboard = getDashboardDataForRole(USER_ROLES.FinanceAdmin, [
      makeWorkOrder({ id: "wo-completed", status: "completed" }),
      makeWorkOrder({ id: "wo-closed", status: "closed" }),
      makeWorkOrder({ id: "wo-new", status: "new" }),
    ]);

    assert.equal(dashboard.eyebrow, "Finance/Admin dashboard");
    assert.equal(
      dashboard.queues.find((queue) => queue.title === "Ready to invoice")?.items
        .length,
      1,
    );
    assert.equal(
      dashboard.quickActions.some((action) => action.label === "Create work order"),
      false,
    );
  });
});

function makeWorkOrder(
  overrides: Partial<PhaseOneWorkOrder> = {},
): PhaseOneWorkOrder {
  return {
    id: "wo-1",
    workOrderNumber: "WO-1",
    status: "new",
    requiresQuote: false,
    currentQuoteId: null,
    currentInvoiceId: null,
    priority: "medium",
    title: "Leaking pipe",
    description: "Pipe under sink is leaking",
    clientId: "client-1",
    locationId: "loc-1",
    clientName: "Northstar Properties",
    locationName: "Pinnacle Tower",
    locationAddress: "110 King St W, Toronto, ON",
    contactName: "Avery Hill",
    contactPhone: "416-555-0119",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-02T00:00:00.000Z",
    requestedServiceDate: null,
    assignedCoordinatorName: "Casey Coordinator",
    assignedManagerName: "Morgan Manager",
    assignedContractorId: null,
    assignedContractorName: null,
    contractorAssignedAt: null,
    contractorAssignedBy: null,
    category: "Plumbing",
    internalNotes: null,
    completionNotes: null,
    createdBy: "Casey Coordinator",
    lastUpdatedBy: "Casey Coordinator",
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    workOrderId: "wo-1",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    invoiceNumber: "INV-1",
    status: "draft",
    issuedDate: null,
    sentAt: null,
    viewedAt: null,
    paidAt: null,
    voidedAt: null,
    subtotal: 100,
    issueDate: null,
    dueDate: "2026-04-30",
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
    notes: null,
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    qboInvoiceId: null,
    qboSyncStatus: null,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    createdBy: "Finley Finance",
    lastUpdatedBy: "Finley Finance",
    ...overrides,
  };
}
