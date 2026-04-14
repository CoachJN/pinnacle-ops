import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  canAddWorkOrderAttachment,
  canAddWorkOrderNote,
  canCreateWorkOrder,
  canEditWorkOrder,
  canListWorkOrders,
  canUpdateWorkOrderStatus,
  canViewWorkOrder,
  getWorkOrderListPermissionScope,
  getAllowedWorkOrderStatusTransitions,
  hasAssignedWorkOrderScope,
  hasClientOrganizationScope,
  hasLocationScope,
  isWorkOrderInActorScope,
  isWorkOrderInternalRole,
  type WorkOrderPermissionTarget,
} from "../server/authorization/work-order.permissions.ts";
import { APP_ROLES } from "../lib/rbac/roles.ts";
import type { ClientAccessActor, ContractorAccessActor, InternalAccessActor } from "../types/auth.ts";
import type { WorkOrderStatus } from "../types/work-order.ts";
import type { WorkOrderStatus as PhaseThreeWorkOrderStatus } from "../modules/work-orders/index.ts";

describe("work-order permissions", () => {
  test("coordinator can create, view, edit, note, attach, and run operational statuses", () => {
    const actor = makeInternalActor(APP_ROLES.Coordinator);
    const target = makeTarget({ status: "in_progress" });
    const quoteReviewTarget = makeTarget({ status: "quote_received" });

    assert.equal(canCreateWorkOrder(actor, target), true);
    assert.equal(canViewWorkOrder(actor, target), true);
    assert.equal(canEditWorkOrder(actor, target), true);
    assert.equal(canAddWorkOrderNote(actor, target), true);
    assert.equal(canAddWorkOrderAttachment(actor, target), true);
    assert.equal(
      canUpdateWorkOrderStatus(actor, target, "completed"),
      true,
    );
    assert.equal(
      canUpdateWorkOrderStatus(
        actor,
        quoteReviewTarget,
        "pending_client_approval",
      ),
      false,
    );
    assert.equal(canUpdateWorkOrderStatus(actor, target, "paid"), false);
    assert.deepEqual(getAllowedWorkOrderStatusTransitions(actor, target), [
      "waiting_on_contractor",
      "waiting_on_customer",
      "completed",
      "cancelled",
    ]);
  });

  test("manager has broader review/status authority than coordinator", () => {
    const actor = makeInternalActor(APP_ROLES.Manager);
    const quoteReceivedTarget = makeTarget({ status: "quote_received" });
    const inReviewTarget = makeTarget({ status: "in_review" });

    assert.equal(
      canUpdateWorkOrderStatus(
        actor,
        quoteReceivedTarget,
        "pending_client_approval",
      ),
      true,
    );
    assert.equal(
      canUpdateWorkOrderStatus(actor, inReviewTarget, "approved_to_proceed"),
      true,
    );
    assert.deepEqual(getAllowedWorkOrderStatusTransitions(actor, quoteReceivedTarget), [
      "pending_client_approval",
      "quote_requested",
      "cancelled",
    ]);
  });

  test("finance/admin has note access, finance-scoped edits, and closeout-only statuses", () => {
    const actor = makeInternalActor(APP_ROLES.FinanceAdmin);
    const completedTarget = makeTarget({ status: "completed" });
    const inProgressTarget = makeTarget({ status: "in_progress" });
    const invoicedTarget = makeTarget({ status: "invoiced" });

    assert.equal(canCreateWorkOrder(actor, completedTarget), false);
    assert.equal(canViewWorkOrder(actor, completedTarget), true);
    assert.equal(canAddWorkOrderNote(actor, completedTarget), true);
    assert.equal(canAddWorkOrderAttachment(actor, completedTarget), false);
    assert.equal(canEditWorkOrder(actor, completedTarget), false);
    assert.equal(
      canEditWorkOrder(actor, completedTarget, { editScope: "finance_admin" }),
      true,
    );
    assert.equal(
      canEditWorkOrder(actor, inProgressTarget, { editScope: "finance_admin" }),
      false,
    );
    assert.equal(
      canUpdateWorkOrderStatus(actor, completedTarget, "invoiced"),
      true,
    );
    assert.equal(
      canUpdateWorkOrderStatus(actor, invoicedTarget, "paid"),
      true,
    );
    assert.equal(
      canUpdateWorkOrderStatus(actor, inProgressTarget, "completed"),
      false,
    );
    assert.deepEqual(getAllowedWorkOrderStatusTransitions(actor, completedTarget), [
      "invoiced",
      "closed",
    ]);
  });

  test("owner has full access to valid transitions including finance closeout", () => {
    const actor = makeInternalActor(APP_ROLES.Owner);
    const target = makeTarget({ status: "completed" });

    assert.equal(canCreateWorkOrder(actor, target), true);
    assert.equal(canEditWorkOrder(actor, { ...target, status: "closed" }), true);
    assert.equal(canAddWorkOrderAttachment(actor, target), true);
    assert.equal(canUpdateWorkOrderStatus(actor, target, "invoiced"), true);
    assert.equal(canUpdateWorkOrderStatus(actor, target, "closed"), true);
  });

  test("client users are limited to their client organization and allowed locations", () => {
    const actor = makeClientActor({
      clientOrganizationId: "client-1",
      locationAccess: {
        kind: "selected_client_locations",
        locationIds: ["loc-1", "loc-2"],
      },
    });
    const visibleTarget = makeTarget({
      clientOrganizationId: "client-1",
      locationId: "loc-2",
    });
    const wrongClientTarget = makeTarget({
      clientOrganizationId: "client-2",
      locationId: "loc-2",
    });
    const wrongLocationTarget = makeTarget({
      clientOrganizationId: "client-1",
      locationId: "loc-9",
    });

    assert.equal(canCreateWorkOrder(actor, visibleTarget), true);
    assert.equal(canViewWorkOrder(actor, visibleTarget), true);
    assert.equal(canEditWorkOrder(actor, visibleTarget), false);
    assert.equal(canAddWorkOrderNote(actor, visibleTarget), false);
    assert.equal(isWorkOrderInActorScope(actor, visibleTarget), true);
    assert.equal(hasClientOrganizationScope(actor, "client-1"), true);
    assert.equal(hasClientOrganizationScope(actor, "client-2"), false);
    assert.equal(hasLocationScope(actor, "loc-1"), true);
    assert.equal(hasLocationScope(actor, "loc-9"), false);
    assert.equal(canViewWorkOrder(actor, wrongClientTarget), false);
    assert.equal(canViewWorkOrder(actor, wrongLocationTarget), false);
    assert.equal(
      canListWorkOrders(actor, {
        organizationId: "org-1",
        scope: "clientOrganization",
        clientOrganizationId: "client-1",
      }),
      true,
    );
    assert.equal(
      canListWorkOrders(actor, {
        organizationId: "org-1",
        scope: "locations",
        clientOrganizationId: "client-1",
        locationIds: ["loc-1", "loc-9"],
      }),
      false,
    );
  });

  test("contractor users can only view and list assigned work in their contractor scope", () => {
    const actor = makeContractorActor({
      contractorOrganizationId: "contractor-1",
      assignedWorkOrderIds: ["wo-1"],
    });
    const assignedTarget = makeTarget({
      id: "wo-1",
      assignedContractorOrganizationId: "contractor-1",
    });
    const differentAssignmentTarget = makeTarget({
      id: "wo-2",
      assignedContractorOrganizationId: "contractor-1",
    });

    assert.equal(canViewWorkOrder(actor, assignedTarget), true);
    assert.equal(isWorkOrderInActorScope(actor, assignedTarget), true);
    assert.equal(canViewWorkOrder(actor, differentAssignmentTarget), false);
    assert.equal(canEditWorkOrder(actor, assignedTarget), false);
    assert.equal(canAddWorkOrderNote(actor, assignedTarget), false);
    assert.equal(hasAssignedWorkOrderScope(actor, "wo-1"), true);
    assert.equal(hasAssignedWorkOrderScope(actor, "wo-2"), false);
    assert.equal(
      canListWorkOrders(actor, {
        organizationId: "org-1",
        scope: "contractorOrganization",
        contractorOrganizationId: "contractor-1",
      }),
      true,
    );
    assert.equal(
      canListWorkOrders(actor, {
        organizationId: "org-1",
        scope: "clientOrganization",
        clientOrganizationId: "client-1",
      }),
      false,
    );
  });

  test("internal role helper follows the canonical role vocabulary", () => {
    assert.equal(isWorkOrderInternalRole(APP_ROLES.Coordinator), true);
    assert.equal(isWorkOrderInternalRole(APP_ROLES.FinanceAdmin), true);
    assert.equal(isWorkOrderInternalRole(APP_ROLES.ClientUser), false);
    assert.equal(isWorkOrderInternalRole(APP_ROLES.ContractorUser), false);
  });

  test("phase 3 uppercase status transitions stay role-aware", () => {
    const coordinator = makeInternalActor(APP_ROLES.Coordinator);
    const manager = makeInternalActor(APP_ROLES.Manager);
    const finance = makeInternalActor(APP_ROLES.FinanceAdmin);
    const owner = makeInternalActor(APP_ROLES.Owner);
    const openTarget = makePhaseThreeTarget({ status: "OPEN" });
    const completedTarget = makePhaseThreeTarget({ status: "COMPLETED" });

    assert.equal(canUpdateWorkOrderStatus(coordinator, openTarget, "IN_PROGRESS"), true);
    assert.equal(canUpdateWorkOrderStatus(manager, completedTarget, "CLOSED"), false);
    assert.equal(canUpdateWorkOrderStatus(finance, completedTarget, "CLOSED"), true);
    assert.equal(canUpdateWorkOrderStatus(owner, completedTarget, "CLOSED"), true);
    assert.deepEqual(getAllowedWorkOrderStatusTransitions(finance, completedTarget), [
      "CLOSED",
    ]);
  });

  test("list scope helper returns explicit actor-scoped constraints", () => {
    const internalActor = makeInternalActor(APP_ROLES.Manager);
    const clientActor = makeClientActor({
      clientOrganizationId: "client-1",
      locationAccess: {
        kind: "selected_client_locations",
        locationIds: ["loc-1", "loc-2"],
      },
    });
    const contractorActor = makeContractorActor({
      contractorOrganizationId: "contractor-1",
    });

    assert.deepEqual(getWorkOrderListPermissionScope(internalActor), {
      organizationId: "org-1",
      scope: "organization",
    });
    assert.deepEqual(getWorkOrderListPermissionScope(clientActor), {
      organizationId: "org-1",
      scope: "locations",
      clientOrganizationId: "client-1",
      locationIds: ["loc-1", "loc-2"],
    });
    assert.deepEqual(getWorkOrderListPermissionScope(contractorActor), {
      organizationId: "org-1",
      scope: "contractorOrganization",
      contractorOrganizationId: "contractor-1",
    });
  });
});

function makeTarget(
  overrides: Partial<WorkOrderPermissionTarget & { status: WorkOrderStatus }> = {},
): WorkOrderPermissionTarget & { status: WorkOrderStatus } {
  return {
    id: "wo-1",
    organizationId: "org-1",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    status: "new",
    requestedByUserId: "user-requester",
    assignedCoordinatorUserId: "user-coordinator",
    assignedManagerUserId: "user-manager",
    assignedContractorOrganizationId: null,
    ...overrides,
  };
}

function makePhaseThreeTarget(
  overrides: Partial<WorkOrderPermissionTarget & { status: PhaseThreeWorkOrderStatus }> = {},
): WorkOrderPermissionTarget & { status: PhaseThreeWorkOrderStatus } {
  return {
    id: "wo-phase-3",
    organizationId: "org-1",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    status: "NEW",
    requestedByUserId: "user-requester",
    assignedCoordinatorUserId: "user-coordinator",
    assignedManagerUserId: "user-manager",
    assignedContractorOrganizationId: null,
    ...overrides,
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

function makeClientActor(overrides: {
  clientOrganizationId?: string;
  locationAccess?: ClientAccessActor["scope"]["locationAccess"];
} = {}): ClientAccessActor {
  return {
    actorType: "client",
    userId: "client-user-1",
    role: APP_ROLES.ClientUser,
    scope: {
      kind: "client",
      organizationId: "org-1",
      clientOrganizationId: overrides.clientOrganizationId ?? "client-1",
      locationAccess: overrides.locationAccess ?? {
        kind: "all_client_locations",
      },
    },
  };
}

function makeContractorActor(overrides: {
  contractorOrganizationId?: string;
  assignedWorkOrderIds?: string[];
} = {}): ContractorAccessActor {
  return {
    actorType: "contractor",
    userId: "contractor-user-1",
    role: APP_ROLES.ContractorUser,
    scope: {
      kind: "contractor",
      organizationId: "org-1",
      contractorOrganizationId:
        overrides.contractorOrganizationId ?? "contractor-1",
      assignedWorkOrderIds: overrides.assignedWorkOrderIds,
    },
  };
}
