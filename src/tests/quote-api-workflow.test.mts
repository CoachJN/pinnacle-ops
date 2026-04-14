import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  canActorReadQuote,
  filterVisibleActivityLogsForActor,
  isAllowedQuoteTransitionForActor,
  safeQuoteSummaryForActor,
} from "../lib/work-orders/quote-api-helpers.ts";
import type { ActivityLog, Quote, WorkOrder } from "../server/repositories/index.ts";
import { USER_ROLES } from "../types/permissions.ts";
import type { AccessActor } from "../types/auth.ts";

describe("quote api workflow helpers", () => {
  test("contractors can read only quotes for their assigned work order", () => {
    const actor = makeContractorActor("contractor-1");
    const assignedWorkOrder = makeWorkOrder({
      assignedContractorOrganizationId: "contractor-1",
    });
    const otherWorkOrder = makeWorkOrder({
      assignedContractorOrganizationId: "contractor-2",
    });
    const quote = makeQuote({ contractorOrganizationId: "contractor-1" });

    assert.equal(canActorReadQuote(actor, assignedWorkOrder, quote), true);
    assert.equal(canActorReadQuote(actor, otherWorkOrder, quote), false);
  });

  test("clients only see current client-facing quote states", () => {
    const actor = makeClientActor("client-1");
    const workOrder = makeWorkOrder({
      clientOrganizationId: "client-1",
      currentQuoteId: "quote-1",
    });

    assert.equal(
      canActorReadQuote(actor, workOrder, makeQuote({ status: "ready_for_client" })),
      true,
    );
    assert.equal(
      canActorReadQuote(actor, workOrder, makeQuote({ status: "submitted" })),
      false,
    );
    assert.equal(
      canActorReadQuote(
        actor,
        makeWorkOrder({
          clientOrganizationId: "client-1",
          currentQuoteId: "quote-other",
        }),
        makeQuote({ status: "ready_for_client" }),
      ),
      false,
    );
  });

  test("client summary omits internal-only quote fields", () => {
    const summary = safeQuoteSummaryForActor(
      makeClientActor("client-1"),
      makeQuote(),
    );

    assert.equal("contractorNotes" in summary, false);
    assert.equal("internalReviewNotes" in summary, false);
    assert.equal(summary.totalAmount, 1750);
  });

  test("activity visibility is filtered by actor type", () => {
    const activity = [
      makeActivity("internal"),
      makeActivity("client"),
      makeActivity("contractor"),
      makeActivity("all"),
    ];

    assert.deepEqual(
      filterVisibleActivityLogsForActor(makeClientActor("client-1"), activity).map(
        (entry) => entry.visibility,
      ),
      ["client", "all"],
    );
    assert.deepEqual(
      filterVisibleActivityLogsForActor(
        makeContractorActor("contractor-1"),
        activity,
      ).map((entry) => entry.visibility),
      ["contractor", "all"],
    );
  });

  test("invalid quote approval shortcuts are blocked", () => {
    const workOrder = makeWorkOrder({ currentQuoteId: "quote-1" });

    assert.equal(
      isAllowedQuoteTransitionForActor(
        makeClientActor("client-1"),
        workOrder,
        makeQuote({ status: "submitted" }),
        "client_approved",
      ),
      false,
    );
    assert.equal(
      isAllowedQuoteTransitionForActor(
        makeManagerActor(),
        workOrder,
        makeQuote({ status: "ready_for_client" }),
        "client_approved",
      ),
      false,
    );
    assert.equal(
      isAllowedQuoteTransitionForActor(
        makeClientActor("client-1"),
        workOrder,
        makeQuote({ status: "ready_for_client" }),
        "client_approved",
      ),
      true,
    );
  });
});

function makeWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: "wo-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-11T10:00:00.000Z",
    updatedAt: "2026-04-11T10:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderNumber: "WO-1",
    title: "Generator alarm",
    description: "Investigate and quote generator repair.",
    status: "quote_requested",
    priority: "medium",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    requestedByUserId: "user-1",
    assignedCoordinatorUserId: "coord-1",
    assignedManagerUserId: "mgr-1",
    assignedContractorOrganizationId: null,
    currentQuoteId: null,
    currentInvoiceId: null,
    clientSnapshot: { id: "client-1", name: "Client" },
    locationSnapshot: { id: "loc-1", name: "Location", addressText: null },
    contractorSnapshot: null,
    category: null,
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
    createdAt: "2026-04-11T10:00:00.000Z",
    updatedAt: "2026-04-11T10:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderId: "wo-1",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    contractorOrganizationId: "contractor-1",
    versionNumber: 1,
    status: "ready_for_client",
    laborAmount: 1000,
    materialAmount: 500,
    otherAmount: 250,
    totalAmount: 1750,
    currency: "CAD",
    scopeSummary: "Replace failed components and test operation.",
    contractorNotes: "Parts are in stock.",
    internalReviewNotes: "Margin approved internally.",
    clientResponseNotes: null,
    submittedByUserId: "user-1",
    submittedAt: "2026-04-11T10:00:00.000Z",
    reviewedAt: "2026-04-11T11:00:00.000Z",
    clientDecisionAt: null,
    workOrderSnapshot: { id: "wo-1", name: "WO-1" },
    contractorSnapshot: { id: "contractor-1", name: "Contractor" },
    ...overrides,
  };
}

function makeActivity(
  visibility: ActivityLog["visibility"],
): ActivityLog {
  return {
    id: `activity-${visibility}`,
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-11T10:00:00.000Z",
    updatedAt: "2026-04-11T10:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderId: "wo-1",
    action: "client_quote.status_changed",
    eventType: "quote_status_changed",
    message: "Changed quote status.",
    actorType: "user",
    actorUserId: "user-1",
    actorRole: USER_ROLES.Manager,
    actor: {
      type: "user",
      userId: "user-1",
      role: USER_ROLES.Manager,
    },
    resourceType: "quote",
    resourceId: "quote-1",
    resourceLabel: "Quote v1",
    resource: {
      type: "quote",
      id: "quote-1",
      label: "Quote v1",
      workOrderId: "wo-1",
    },
    entityType: "quote",
    entityId: "quote-1",
    occurredAt: "2026-04-11T10:00:00.000Z",
    requestId: null,
    visibility,
    changes: [],
    metadata: {},
  };
}

function makeClientActor(clientOrganizationId: string): AccessActor {
  return {
    actorType: "client",
    userId: "client-user-1",
    role: USER_ROLES.ClientUser,
    scope: {
      kind: "client",
      organizationId: "org-1",
      clientOrganizationId,
      locationAccess: { kind: "all_client_locations" },
    },
  };
}

function makeContractorActor(contractorOrganizationId: string): AccessActor {
  return {
    actorType: "contractor",
    userId: "contractor-user-1",
    role: USER_ROLES.ContractorUser,
    scope: {
      kind: "contractor",
      organizationId: "org-1",
      contractorOrganizationId,
    },
  };
}

function makeManagerActor(): AccessActor {
  return {
    actorType: "internal",
    userId: "manager-1",
    role: USER_ROLES.Manager,
    scope: {
      kind: "internal",
      organizationId: "org-1",
    },
  };
}
