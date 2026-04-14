import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  canCreateQuote,
  canCreateQuoteRevision,
  canRecordClientApproval,
  canSendQuoteToClient,
} from "../lib/permissions/quote-permissions.ts";
import { canTransitionWorkOrder } from "../lib/permissions/work-order-permissions.ts";
import { USER_ROLES } from "../types/permissions.ts";
import type { Quote } from "../types/quote.ts";
import type { PhaseOneWorkOrder } from "../types/work-order.ts";

describe("phase 4 quote workflow permissions", () => {
  test("blocks dispatch when a quote-required work order lacks client approval", () => {
    const workOrder = makeWorkOrder({
      status: "in_review",
      requiresQuote: true,
      currentQuoteId: null,
    });

    assert.equal(
      canTransitionWorkOrder(
        USER_ROLES.Manager,
        workOrder,
        "dispatched",
        { currentQuoteStatus: null },
      ),
      false,
    );
  });

  test("allows dispatch after quote-required work reaches approved to proceed", () => {
    const workOrder = makeWorkOrder({
      status: "approved_to_proceed",
      requiresQuote: true,
      currentQuoteId: "quote-1",
    });

    assert.equal(
      canTransitionWorkOrder(
        USER_ROLES.Manager,
        workOrder,
        "dispatched",
        { currentQuoteStatus: "client_approved" },
      ),
      true,
    );
  });

  test("keeps coordinator execution separate from manager approval authority", () => {
    const workOrder = makeWorkOrder({
      status: "quote_received",
      requiresQuote: true,
      currentQuoteId: "quote-1",
    });
    const quote = makeQuote({ status: "under_review" });

    assert.equal(canCreateQuote(USER_ROLES.Coordinator, workOrder), false);
    assert.equal(
      canSendQuoteToClient(USER_ROLES.Coordinator, workOrder, quote),
      false,
    );
    assert.equal(canSendQuoteToClient(USER_ROLES.Manager, workOrder, quote), true);
  });

  test("records client decision only from ready for client state", () => {
    const workOrder = makeWorkOrder({
      status: "pending_client_approval",
      requiresQuote: true,
      currentQuoteId: "quote-1",
    });

    assert.equal(
      canRecordClientApproval(
        USER_ROLES.Manager,
        workOrder,
        makeQuote({ status: "ready_for_client" }),
      ),
      true,
    );
    assert.equal(
      canRecordClientApproval(
        USER_ROLES.Manager,
        workOrder,
        makeQuote({ status: "under_review" }),
      ),
      false,
    );
  });

  test("allows revisions for rejected current quotes", () => {
    const workOrder = makeWorkOrder({
      status: "quote_requested",
      requiresQuote: true,
      currentQuoteId: "quote-1",
    });

    assert.equal(
      canCreateQuoteRevision(
        USER_ROLES.Coordinator,
        workOrder,
        makeQuote({ status: "client_rejected" }),
      ),
      true,
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
