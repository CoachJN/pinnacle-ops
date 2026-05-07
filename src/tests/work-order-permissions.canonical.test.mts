import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  canAddWorkOrderAttachment,
  canAddWorkOrderNote,
  canUpdateWorkOrderStatus,
  getAllowedWorkOrderStatusTransitions,
} from "../server/authorization/work-order.permissions.ts";
import type {
  ClientAccessActor,
  ContractorAccessActor,
  InternalAccessActor,
} from "../types/auth.ts";
import { USER_ROLES } from "../types/permissions.ts";

describe("canonical work order permissions", () => {
  test("coordinator can advance assigned execution states but not finance closeout", () => {
    const actor = makeInternalActor(USER_ROLES.Coordinator);
    const target = makeTarget({ status: "assigned" });

    assert.equal(canUpdateWorkOrderStatus(actor, target, "contractor_scheduled"), true);
    assert.equal(canUpdateWorkOrderStatus(actor, target, "paid"), false);
    assert.deepEqual(getAllowedWorkOrderStatusTransitions(actor, target), [
      "awaiting_contractor_response",
      "quote_required",
      "contractor_scheduled",
      "on_hold",
      "escalated",
      "cancelled",
    ]);
  });

  test("finance is limited to invoicing and closeout states", () => {
    const actor = makeInternalActor(USER_ROLES.FinanceAdmin);
    const target = makeTarget({ status: "ready_for_invoicing" });

    assert.equal(canAddWorkOrderNote(actor, target), true);
    assert.equal(canAddWorkOrderAttachment(actor, target), false);
    assert.equal(canUpdateWorkOrderStatus(actor, target, "invoiced"), true);
    assert.equal(canUpdateWorkOrderStatus(actor, target, "client_approved"), false);
  });

  test("client and contractor actors cannot mutate lifecycle status", () => {
    const client = makeClientActor();
    const contractor = makeContractorActor();
    const target = makeTarget({
      status: "client_approval_requested",
      assignedContractorId: "contractor-1",
    });

    assert.equal(canUpdateWorkOrderStatus(client, target, "client_approved"), false);
    assert.equal(canUpdateWorkOrderStatus(contractor, target, "client_approved"), false);
  });
});

function makeTarget(
  overrides: Partial<{
    status: "new" | "triage" | "assigned" | "awaiting_contractor_response" | "quote_required" | "contractor_quote_received" | "quote_under_review" | "client_approval_requested" | "client_approved" | "contractor_scheduled" | "in_progress" | "work_completed" | "completion_review" | "ready_for_invoicing" | "invoiced" | "paid" | "closed" | "on_hold" | "escalated" | "cancelled";
    assignedContractorId: string | null;
  }> = {},
) {
  return {
    organizationId: "org-1",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    status: overrides.status ?? "triage",
    assignedContractorId: overrides.assignedContractorId ?? null,
  };
}

function makeInternalActor(role: InternalAccessActor["role"]): InternalAccessActor {
  return {
    actorType: "internal",
    userId: "user-1",
    role,
    scope: {
      kind: "internal",
      organizationId: "org-1",
    },
  };
}

function makeClientActor(): ClientAccessActor {
  return {
    actorType: "client",
    userId: "client-1",
    role: USER_ROLES.ClientUser,
    scope: {
      kind: "client",
      organizationId: "org-1",
      clientOrganizationId: "client-1",
      locationAccess: { kind: "all_client_locations" },
    },
  };
}

function makeContractorActor(): ContractorAccessActor {
  return {
    actorType: "contractor",
    userId: "contractor-user-1",
    role: USER_ROLES.ContractorUser,
    scope: {
      kind: "contractor",
      organizationId: "org-1",
      contractorOrganizationId: "contractor-1",
    },
  };
}
