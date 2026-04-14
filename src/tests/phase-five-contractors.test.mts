import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  canAssignContractor,
  canSubmitContractorQuote,
  canUpdateContractorExecutionStatus,
  canViewContractorModule,
  canViewContractorWorkOrder,
} from "../lib/permissions/contractor-permissions.ts";
import { getContractorWorkOrderDetailView } from "../lib/contractors/projections.ts";
import { USER_ROLES } from "../types/permissions.ts";
import type { ContractorSessionContext } from "../types/contractor.ts";
import type { PhaseOneWorkOrder } from "../types/work-order.ts";

describe("phase 5 contractor permissions", () => {
  test("contractors can view only their assigned work order projection", () => {
    const assigned = makeWorkOrder({
      assignedContractorId: "contractor-summit-mechanical",
    });
    const unassigned = makeWorkOrder({
      assignedContractorId: "contractor-other",
    });
    const session = makeContractorSession("contractor-summit-mechanical");

    assert.equal(
      canViewContractorWorkOrder(
        USER_ROLES.ContractorUser,
        assigned,
        session,
      ),
      true,
    );
    assert.equal(
      canViewContractorWorkOrder(
        USER_ROLES.ContractorUser,
        unassigned,
        session,
      ),
      false,
    );
  });

  test("contractor quotes are limited to assigned quote-requested work", () => {
    const session = makeContractorSession("contractor-summit-mechanical");

    assert.equal(
      canSubmitContractorQuote(
        USER_ROLES.ContractorUser,
        makeWorkOrder({
          status: "quote_requested",
          requiresQuote: true,
          assignedContractorId: "contractor-summit-mechanical",
        }),
        session,
      ),
      true,
    );
    assert.equal(
      canSubmitContractorQuote(
        USER_ROLES.ContractorUser,
        makeWorkOrder({
          status: "quote_requested",
          requiresQuote: true,
          assignedContractorId: "contractor-other",
        }),
        session,
      ),
      false,
    );
  });

  test("contractor execution follows the direct MVP status model", () => {
    const session = makeContractorSession("contractor-summit-mechanical");

    assert.equal(
      canUpdateContractorExecutionStatus(
        USER_ROLES.ContractorUser,
        makeWorkOrder({
          status: "approved_to_proceed",
          assignedContractorId: "contractor-summit-mechanical",
        }),
        session,
        "in_progress",
      ),
      true,
    );
    assert.equal(
      canUpdateContractorExecutionStatus(
        USER_ROLES.ContractorUser,
        makeWorkOrder({
          status: "in_progress",
          assignedContractorId: "contractor-summit-mechanical",
        }),
        session,
        "completed",
      ),
      true,
    );
    assert.equal(
      canUpdateContractorExecutionStatus(
        USER_ROLES.ContractorUser,
        makeWorkOrder({
          status: "completed",
          assignedContractorId: "contractor-summit-mechanical",
        }),
        session,
        "closed",
      ),
      false,
    );
  });

  test("internal contractor module permissions are read-only for finance/admin", () => {
    const workOrder = makeWorkOrder({ status: "in_review" });

    assert.equal(canViewContractorModule(USER_ROLES.FinanceAdmin), true);
    assert.equal(canAssignContractor(USER_ROLES.FinanceAdmin, workOrder), false);
    assert.equal(canAssignContractor(USER_ROLES.Coordinator, workOrder), true);
  });
});

describe("phase 5 contractor projections", () => {
  test("detail projection omits internal-only fields for assigned contractor", async () => {
    const projection = await getContractorWorkOrderDetailView(
      "contractor-summit-mechanical",
      "wo-1008",
    );

    assert.ok(projection);
    assert.equal("internalNotes" in projection, false);
    assert.equal("internalReviewNotes" in projection, false);
    assert.equal(projection?.id, "wo-1008");
  });

  test("detail projection exposes only contractor-owned current quote details", async () => {
    const projection = await getContractorWorkOrderDetailView(
      "contractor-signalworks",
      "wo-1011",
    );

    assert.ok(projection);
    assert.ok(projection.quote);
    assert.equal(projection.quote.id, "quote-1011-v1");
    assert.equal("internalReviewNotes" in projection.quote, false);
  });

  test("detail projection safely hides unassigned work orders", async () => {
    const projection = await getContractorWorkOrderDetailView(
      "contractor-summit-mechanical",
      "wo-1003",
    );

    assert.equal(projection, null);
  });
});

function makeContractorSession(
  contractorId: string,
): ContractorSessionContext {
  return {
    userId: `usr-${contractorId}`,
    name: "Contractor User",
    contractorId,
  };
}

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
