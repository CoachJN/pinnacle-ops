import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  canTransitionWorkOrder,
  getRoleAllowedTransitions,
} from "../lib/permissions/work-order-permissions.ts";
import {
  canTransitionWorkOrderStatus,
  getAllowedStatusTransitions,
  isTerminalWorkOrderStatus,
  WORK_ORDER_TRANSITIONS,
} from "../lib/work-orders/status.ts";
import { USER_ROLES } from "../types/permissions.ts";
import type { Invoice } from "../types/invoice.ts";

describe("phase one work order lifecycle", () => {
  test("uses the strict MVP transition map", () => {
    assert.deepEqual(getAllowedStatusTransitions("new"), [
      "in_review",
      "cancelled",
    ]);
    assert.deepEqual(getAllowedStatusTransitions("in_review"), [
      "quote_requested",
      "dispatched",
      "cancelled",
    ]);
    assert.deepEqual(getAllowedStatusTransitions("quote_requested"), [
      "quote_received",
      "cancelled",
    ]);
    assert.deepEqual(getAllowedStatusTransitions("quote_received"), [
      "pending_client_approval",
      "quote_requested",
      "cancelled",
    ]);
    assert.deepEqual(getAllowedStatusTransitions("pending_client_approval"), [
      "approved_to_proceed",
      "quote_requested",
      "cancelled",
    ]);
    assert.deepEqual(getAllowedStatusTransitions("approved_to_proceed"), [
      "dispatched",
      "cancelled",
    ]);
    assert.deepEqual(getAllowedStatusTransitions("dispatched"), [
      "in_progress",
      "cancelled",
    ]);
    assert.deepEqual(getAllowedStatusTransitions("in_progress"), [
      "completed",
      "cancelled",
    ]);
    assert.deepEqual(getAllowedStatusTransitions("completed"), [
      "invoiced",
      "cancelled",
    ]);
    assert.deepEqual(getAllowedStatusTransitions("invoiced"), ["paid"]);
    assert.deepEqual(getAllowedStatusTransitions("paid"), ["closed"]);
    assert.deepEqual(WORK_ORDER_TRANSITIONS.closed, []);
    assert.deepEqual(WORK_ORDER_TRANSITIONS.cancelled, []);
  });

  test("blocks backward and terminal transitions", () => {
    assert.equal(canTransitionWorkOrderStatus("completed", "in_progress"), false);
    assert.equal(canTransitionWorkOrderStatus("closed", "cancelled"), false);
    assert.equal(canTransitionWorkOrderStatus("cancelled", "new"), false);
    assert.equal(isTerminalWorkOrderStatus("closed"), true);
    assert.equal(isTerminalWorkOrderStatus("cancelled"), true);
  });
});

describe("phase one work order action permissions", () => {
  test("coordinator can run operational transitions but cannot close", () => {
    assert.equal(
      canTransitionWorkOrder(USER_ROLES.Coordinator, "new", "in_review"),
      true,
    );
    assert.equal(
      canTransitionWorkOrder(USER_ROLES.Coordinator, "completed", "closed"),
      false,
    );
  });

  test("finance/admin controls invoice and paid closeout transitions", () => {
    assert.equal(
      canTransitionWorkOrder(USER_ROLES.FinanceAdmin, "completed", "invoiced", {
        currentInvoice: makeInvoice({ status: "issued" }),
      }),
      true,
    );
    assert.equal(
      canTransitionWorkOrder(USER_ROLES.FinanceAdmin, "invoiced", "paid", {
        currentInvoice: makeInvoice({ status: "paid" }),
      }),
      true,
    );
    assert.equal(
      canTransitionWorkOrder(USER_ROLES.FinanceAdmin, "paid", "closed", {
        currentInvoice: makeInvoice({ status: "paid" }),
      }),
      true,
    );
    assert.equal(
      canTransitionWorkOrder(USER_ROLES.FinanceAdmin, "new", "in_review"),
      false,
    );
  });

  test("owner receives every lifecycle-valid transition", () => {
    assert.deepEqual(getRoleAllowedTransitions(USER_ROLES.Owner, "completed"), [
      "cancelled",
    ]);
    assert.deepEqual(getRoleAllowedTransitions(USER_ROLES.Owner, "cancelled"), []);
  });
});

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "inv-1",
    workOrderId: "wo-1",
    invoiceNumber: "INV-1",
    status: "draft",
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
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    createdBy: "Finley Finance",
    lastUpdatedBy: "Finley Finance",
    ...overrides,
  };
}
