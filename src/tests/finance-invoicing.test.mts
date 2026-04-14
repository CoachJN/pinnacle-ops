import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFinanceQueue,
  buildInvoiceCreationEligibility,
} from "../modules/finance/index.ts";
import {
  AUTHORITY_CATEGORIES,
  PERMISSION_ENTITIES,
  USER_ROLES,
  roleCanAccessEntity,
} from "../types/permissions.ts";

test("invoice creation eligibility allows completed work without an active invoice", () => {
  const result = buildInvoiceCreationEligibility({
    workOrderStatus: "completed",
    hasActiveInvoice: false,
  });

  assert.equal(result.eligible, true);
  assert.equal(result.reason, null);
  assert.equal(result.duplicatePolicy, "single_active_invoice_per_work_order");
});

test("invoice creation eligibility rejects duplicate active invoices in MVP", () => {
  const result = buildInvoiceCreationEligibility({
    workOrderStatus: "completed",
    hasActiveInvoice: true,
  });

  assert.equal(result.eligible, false);
  assert.match(result.reason ?? "", /active invoice/i);
});

test("finance queue includes ready-for-invoicing work and overdue invoices", () => {
  const queue = buildFinanceQueue({
    workOrders: [
      {
        id: "wo-ready",
        workOrderNumber: "WO-READY",
        title: "Ready work",
        status: "completed",
        priority: "medium",
        clientOrganizationId: "client-1",
        locationId: "loc-1",
        currentInvoiceId: null,
        clientSnapshot: { id: "client-1", name: "Northstar" },
        locationSnapshot: { id: "loc-1", name: "Pinnacle Tower" },
        completedAt: "2026-04-10T00:00:00.000Z",
        updatedAt: "2026-04-10T00:00:00.000Z",
      },
      {
        id: "wo-overdue",
        workOrderNumber: "WO-OVERDUE",
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

  assert.deepEqual(
    queue.map((item) => [item.state, item.workOrder.id]),
    [
      ["ready_for_invoicing", "wo-ready"],
      ["overdue", "wo-overdue"],
    ],
  );
});

test("invoice create authority is finance-only in the permission matrix", () => {
  assert.equal(
    roleCanAccessEntity(
      USER_ROLES.Manager,
      PERMISSION_ENTITIES.Invoices,
      AUTHORITY_CATEGORIES.Create,
    ),
    false,
  );
  assert.equal(
    roleCanAccessEntity(
      USER_ROLES.FinanceAdmin,
      PERMISSION_ENTITIES.Invoices,
      AUTHORITY_CATEGORIES.Create,
    ),
    true,
  );
});
