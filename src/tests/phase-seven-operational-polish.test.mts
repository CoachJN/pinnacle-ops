import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  getInvoiceOperationalFlags,
  getQuoteOperationalFlags,
  getWorkOrderOperationalFlags,
} from "../lib/flags/operational-flags.ts";
import {
  getInvoiceActionAvailability,
  getWorkOrderActionAvailability,
} from "../lib/workflow/action-availability.ts";
import { USER_ROLES } from "../types/permissions.ts";
import type { Invoice } from "../types/invoice.ts";
import type { Quote } from "../types/quote.ts";
import type { PhaseOneWorkOrder } from "../types/work-order.ts";

describe("phase 7 derived operational flags", () => {
  test("derives stale active work without mutating the source status", () => {
    const workOrder = makeWorkOrder({
      status: "in_progress",
      updatedAt: "2026-04-01T12:00:00.000Z",
    });

    const flags = getWorkOrderOperationalFlags(workOrder, {
      now: new Date("2026-04-11T12:00:00.000Z"),
    });

    assert.equal(flags.isActive, true);
    assert.equal(flags.isStale, true);
    assert.equal(workOrder.status, "in_progress");
  });

  test("derives overdue sent invoice from due date", () => {
    const invoice = makeInvoice({
      status: "sent",
      dueDate: "2026-04-05",
    });

    assert.equal(
      getInvoiceOperationalFlags(
        invoice,
        new Date("2026-04-11T12:00:00.000Z"),
      ).isOverdue,
      true,
    );
    assert.equal(invoice.status, "sent");
  });

  test("derives quote blocking and revision states from the current quote", () => {
    const workOrder = makeWorkOrder({
      requiresQuote: true,
      currentQuoteId: "quote-1",
    });

    const rejected = getQuoteOperationalFlags(
      workOrder,
      makeQuote({ status: "client_rejected" }),
    );
    const approved = getQuoteOperationalFlags(
      workOrder,
      makeQuote({ status: "client_approved" }),
    );

    assert.equal(rejected.isBlockingDispatch, true);
    assert.equal(rejected.needsRevision, true);
    assert.equal(approved.isBlockingDispatch, false);
  });
});

describe("phase 7 action availability helpers", () => {
  test("work order edit availability mirrors role permissions", () => {
    const workOrder = makeWorkOrder({ status: "in_review" });

    assert.equal(
      getWorkOrderActionAvailability(USER_ROLES.Coordinator, workOrder).edit
        .allowed,
      true,
    );
    assert.equal(
      getWorkOrderActionAvailability(USER_ROLES.FinanceAdmin, workOrder).edit
        .allowed,
      false,
    );
  });

  test("explains paid closeout availability through current invoice state", () => {
    const workOrder = makeWorkOrder({
      status: "paid",
      currentInvoiceId: "inv-1",
    });
    const invoice = makeInvoice({ id: "inv-1", status: "paid" });

    const availability = getInvoiceActionAvailability(
      USER_ROLES.FinanceAdmin,
      workOrder,
      invoice,
    );

    assert.equal(availability.close.allowed, true);
    assert.equal(availability.close.reason, null);
    assert.equal(
      getInvoiceActionAvailability(USER_ROLES.Coordinator, workOrder, invoice)
        .close.allowed,
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
    status: "quote_requested",
    requiresQuote: true,
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

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "quote-1",
    workOrderId: "wo-1",
    assignedContractorId: null,
    versionNumber: 1,
    status: "draft",
    contractorName: "Rapid Plumbing",
    submittedByName: "Casey Coordinator",
    submittedByRole: USER_ROLES.Coordinator,
    laborAmount: 100,
    materialAmount: 50,
    otherAmount: 25,
    totalAmount: 175,
    scopeSummary: "Repair visible leak.",
    contractorNotes: null,
    internalReviewNotes: null,
    clientResponseNotes: null,
    submittedAt: null,
    reviewedAt: null,
    clientDecisionAt: null,
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
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
    dueDate: "2026-04-20",
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
