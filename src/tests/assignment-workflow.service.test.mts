import assert from "node:assert/strict";
import test from "node:test";

import {
  acceptAssignment,
  completeAssignment,
  createAssignment,
  declineAssignment,
  getAllowedWorkOrderActions,
  reassignAssignment,
  transitionWorkOrderStatusWithAssignmentChecks,
} from "../lib/services/work-orders/assignment-workflow.service.ts";
import { USER_ROLES } from "../types/permissions.ts";

test("valid assignment creation persists an active assignment", async () => {
  const harness = createHarness();

  const result = await createAssignment(harness.dependencies, {
    ...auditContext(USER_ROLES.Coordinator, "user-coordinator"),
    workOrderId: harness.workOrder.id,
    payload: {
      workOrderId: harness.workOrder.id,
      assigneeType: "contractor",
      assigneeUserId: "user-contractor",
      scheduledDate: "2026-04-20T00:00:00.000Z",
      timeWindowStart: "2026-04-20T13:00:00.000Z",
      timeWindowEnd: "2026-04-20T15:00:00.000Z",
      notes: "Bring replacement valve",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(harness.assignmentStore.size, 1);
  assert.equal(harness.workOrder.status, "ASSIGNED");
});

test("unauthorized assignment creation is rejected", async () => {
  const harness = createHarness();

  const result = await createAssignment(harness.dependencies, {
    ...auditContext(USER_ROLES.ClientUser, "user-client"),
    workOrderId: harness.workOrder.id,
    payload: {
      workOrderId: harness.workOrder.id,
      assigneeType: "contractor",
      assigneeUserId: "user-contractor",
    },
  });

  assert.equal(result.ok, false);
});

test("assignment creation rejects route/body work order mismatch", async () => {
  const harness = createHarness();

  const result = await createAssignment(harness.dependencies, {
    ...auditContext(USER_ROLES.Manager, "user-manager"),
    workOrderId: harness.workOrder.id,
    payload: {
      workOrderId: "wo-other",
      assigneeType: "contractor",
      assigneeUserId: "user-contractor",
    },
  });

  assert.equal(result.ok, false);
});

test("reassign flow cancels prior assignment and creates a new one", async () => {
  const harness = createHarness();
  const first = await createAssignment(harness.dependencies, {
    ...auditContext(USER_ROLES.Manager, "user-manager"),
    workOrderId: harness.workOrder.id,
    payload: {
      workOrderId: harness.workOrder.id,
      assigneeType: "contractor",
      assigneeUserId: "user-contractor",
    },
  });
  assert.equal(first.ok, true);

  const result = await reassignAssignment(harness.dependencies, {
    ...auditContext(USER_ROLES.Manager, "user-manager"),
    workOrderId: harness.workOrder.id,
    payload: {
      currentAssignmentId: first.value.id,
      workOrderId: harness.workOrder.id,
      assigneeType: "internal",
      assigneeUserId: "user-coordinator",
      notes: "Take over internally",
    },
  });

  assert.equal(result.ok, true);
  assert.equal(harness.assignmentStore.size, 2);
  assert.equal(harness.assignmentStore.get(first.value.id)?.status, "cancelled");
  assert.equal(result.value.assigneeUserId, "user-coordinator");
});

test("accept and decline flows are enforced for the assigned user", async () => {
  const harness = createHarness();
  const created = await createAssignment(harness.dependencies, {
    ...auditContext(USER_ROLES.Manager, "user-manager"),
    workOrderId: harness.workOrder.id,
    payload: {
      workOrderId: harness.workOrder.id,
      assigneeType: "contractor",
      assigneeUserId: "user-contractor",
    },
  });
  assert.equal(created.ok, true);

  const accepted = await acceptAssignment(harness.dependencies, {
    ...auditContext(USER_ROLES.ContractorUser, "user-contractor"),
    workOrderId: harness.workOrder.id,
    payload: { assignmentId: created.value.id },
  });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.value.status, "accepted");

  const declined = await declineAssignment(harness.dependencies, {
    ...auditContext(USER_ROLES.ContractorUser, "user-contractor"),
    workOrderId: harness.workOrder.id,
    payload: { assignmentId: created.value.id, notes: "Cannot make the window" },
  });
  assert.equal(declined.ok, false);
});

test("invalid transition to in progress is blocked without accepted assignment", async () => {
  const harness = createHarness();
  await createAssignment(harness.dependencies, {
    ...auditContext(USER_ROLES.Manager, "user-manager"),
    workOrderId: harness.workOrder.id,
    payload: {
      workOrderId: harness.workOrder.id,
      assigneeType: "contractor",
      assigneeUserId: "user-contractor",
    },
  });

  const result = await transitionWorkOrderStatusWithAssignmentChecks(
    harness.dependencies,
    actor(USER_ROLES.Manager, "user-manager"),
    {
      ...auditContext(USER_ROLES.Manager, "user-manager"),
      workOrderId: harness.workOrder.id,
      payload: { status: "IN_PROGRESS" },
    },
  );

  assert.equal(result.ok, false);
});

test("valid transition to in progress succeeds after accepted assignment", async () => {
  const harness = createHarness();
  const created = await createAssignment(harness.dependencies, {
    ...auditContext(USER_ROLES.Manager, "user-manager"),
    workOrderId: harness.workOrder.id,
    payload: {
      workOrderId: harness.workOrder.id,
      assigneeType: "contractor",
      assigneeUserId: "user-contractor",
    },
  });
  assert.equal(created.ok, true);

  await acceptAssignment(harness.dependencies, {
    ...auditContext(USER_ROLES.ContractorUser, "user-contractor"),
    workOrderId: harness.workOrder.id,
    payload: { assignmentId: created.value.id },
  });

  const result = await transitionWorkOrderStatusWithAssignmentChecks(
    harness.dependencies,
    actor(USER_ROLES.Manager, "user-manager"),
    {
      ...auditContext(USER_ROLES.Manager, "user-manager"),
      workOrderId: harness.workOrder.id,
      payload: { status: "IN_PROGRESS" },
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.value.status, "IN_PROGRESS");
});

test("complete assignment flow allows assignee completion", async () => {
  const harness = createHarness({ workOrderStatus: "IN_PROGRESS" });
  const created = makeAcceptedAssignment(harness, "user-contractor");

  const result = await completeAssignment(harness.dependencies, {
    ...auditContext(USER_ROLES.ContractorUser, "user-contractor"),
    workOrderId: harness.workOrder.id,
    payload: { assignmentId: created.id, notes: "Work finished" },
  });

  assert.equal(result.ok, true);
  assert.equal(result.value.status, "completed");
});

test("allowed action calculation changes by role and assignment state", () => {
  const managerActions = getAllowedWorkOrderActions({
    actor: actor(USER_ROLES.Manager, "user-manager"),
    workOrder: { ...baseModuleWorkOrder(), status: "ASSIGNED" },
    activeAssignment: {
      ...baseModuleAssignment(),
      status: "accepted",
    },
  });
  const contractorActions = getAllowedWorkOrderActions({
    actor: actor(USER_ROLES.ContractorUser, "user-contractor"),
    workOrder: { ...baseModuleWorkOrder(), status: "IN_PROGRESS" },
    activeAssignment: {
      ...baseModuleAssignment(),
      assigneeUserId: "user-contractor",
      assigneeType: "contractor",
      status: "accepted",
    },
  });

  assert.equal(managerActions.canReassign, true);
  assert.equal(managerActions.availableStatusTransitions.includes("IN_PROGRESS"), true);
  assert.equal(contractorActions.canCompleteAssignment, true);
  assert.equal(contractorActions.canAcceptAssignment, false);
  assert.equal(
    contractorActions.availableStatusTransitions.includes("COMPLETED"),
    true,
  );
});

test("accepted assignments no longer expose accept or decline actions", () => {
  const actions = getAllowedWorkOrderActions({
    actor: actor(USER_ROLES.ContractorUser, "user-contractor"),
    workOrder: { ...baseModuleWorkOrder(), status: "ASSIGNED" },
    activeAssignment: {
      ...baseModuleAssignment(),
      assigneeType: "contractor",
      assigneeUserId: "user-contractor",
      status: "accepted",
      acceptedAt: "2026-04-14T01:00:00.000Z",
    },
  });

  assert.equal(actions.canAcceptAssignment, false);
  assert.equal(actions.canDeclineAssignment, false);
});

test("completed work orders must move through ready for invoicing before close", () => {
  const actions = getAllowedWorkOrderActions({
    actor: actor(USER_ROLES.Manager, "user-manager"),
    workOrder: { ...baseModuleWorkOrder(), status: "COMPLETED" },
    activeAssignment: {
      ...baseModuleAssignment(),
      status: "completed",
      completedAt: "2026-04-14T03:00:00.000Z",
    },
  });

  assert.equal(actions.availableStatusTransitions.includes("READY_FOR_INVOICING"), true);
  assert.equal(actions.availableStatusTransitions.includes("CLOSED"), false);
});

function createHarness(input: { workOrderStatus?: "NEW" | "ASSIGNED" | "IN_PROGRESS" } = {}) {
  const workOrder = {
    ...baseModuleWorkOrder(),
    status: input.workOrderStatus ?? "NEW",
  };
  const assignmentStore = new Map();
  const userProfiles = new Map([
    ["user-manager", makeUserProfile("user-manager", USER_ROLES.Manager)],
    ["user-coordinator", makeUserProfile("user-coordinator", USER_ROLES.Coordinator)],
    [
      "user-contractor",
      makeUserProfile("user-contractor", USER_ROLES.ContractorUser, {
        contractorOrganizationId: "contractor-org-1",
      }),
    ],
    ["user-client", makeUserProfile("user-client", USER_ROLES.ClientUser)],
  ]);
  const activityEvents = [];

  return {
    workOrder,
    assignmentStore,
    activityEvents,
    dependencies: {
      assignments: {
        newId: () => `assignment-${assignmentStore.size + 1}`,
        async getById(id) {
          return assignmentStore.get(id) ?? null;
        },
        async create(entity) {
          assignmentStore.set(entity.id, entity);
          return { id: entity.id, item: entity };
        },
        async save(entity) {
          assignmentStore.set(entity.id, entity);
          return { id: entity.id, item: entity };
        },
        async listByWorkOrderId(workOrderId) {
          const items = [...assignmentStore.values()].filter(
            (assignment) => assignment.workOrderId === workOrderId,
          );
          return { items, count: items.length };
        },
        async getActiveByWorkOrderId(workOrderId) {
          return (
            [...assignmentStore.values()].find(
              (assignment) =>
                assignment.workOrderId === workOrderId &&
                (assignment.status === "assigned" || assignment.status === "accepted"),
            ) ?? null
          );
        },
      },
      workOrders: {
        async getById(id) {
          return id === workOrder.id ? workOrder : null;
        },
        async updateStatus(inputUpdate) {
          if (inputUpdate.workOrderId !== workOrder.id) {
            return null;
          }

          workOrder.status = inputUpdate.status;
          workOrder.updatedAt = inputUpdate.now ?? workOrder.updatedAt;
          workOrder.closedAt =
            inputUpdate.closedAt === undefined ? workOrder.closedAt : inputUpdate.closedAt;
          return workOrder;
        },
      },
      userProfiles: {
        async getById(id) {
          return userProfiles.get(id) ?? null;
        },
      },
      activityLogs: {
        async record(entry) {
          activityEvents.push(entry);
          return { ok: true, value: entry };
        },
      },
    },
  };
}

function makeAcceptedAssignment(harness, assigneeUserId) {
  const assignment = {
    id: "assignment-accepted",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
    createdByUserId: "user-manager",
    updatedByUserId: "user-manager",
    workOrderId: harness.workOrder.id,
    contractorOrganizationId: "contractor-org-1",
    assigneeType: "contractor",
    assigneeUserId,
    assigneeOrganizationId: "contractor-org-1",
    assignedByUserId: "user-manager",
    status: "accepted",
    scheduledDate: null,
    timeWindowStart: null,
    timeWindowEnd: null,
    assignedAt: "2026-04-14T00:00:00.000Z",
    acceptedAt: "2026-04-14T01:00:00.000Z",
    declinedAt: null,
    completedAt: null,
    notes: null,
    workOrderSnapshot: {
      id: harness.workOrder.id,
      name: harness.workOrder.workOrderNumber,
    },
    contractorSnapshot: {
      id: "contractor-org-1",
      name: "Summit Mechanical",
    },
  };
  harness.assignmentStore.set(assignment.id, assignment);
  return assignment;
}

function baseModuleWorkOrder() {
  return {
    id: "wo-1",
    workOrderNumber: "WO-1001",
    title: "Leaking pipe",
    description: "Pipe under sink is leaking",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    status: "NEW",
    priority: "MEDIUM",
    category: "PLUMBING",
    requestedByName: "Alex Requester",
    requestedByEmail: "alex@example.com",
    requestedByPhone: null,
    source: "MANUAL",
    createdByUserId: "user-manager",
    assignedCoordinatorUserId: null,
    assignedManagerUserId: null,
    dueDate: null,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
    closedAt: null,
    isArchived: false,
    searchText: "wo-1001 leaking pipe",
  };
}

function baseModuleAssignment() {
  return {
    id: "assignment-1",
    workOrderId: "wo-1",
    assigneeType: "internal",
    assigneeUserId: "user-manager",
    assigneeOrganizationId: "org-1",
    assignedByUserId: "user-manager",
    status: "assigned",
    scheduledDate: null,
    timeWindowStart: null,
    timeWindowEnd: null,
    assignedAt: "2026-04-14T00:00:00.000Z",
    acceptedAt: null,
    declinedAt: null,
    completedAt: null,
    notes: null,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
  };
}

function makeUserProfile(id, role, overrides = {}) {
  return {
    id,
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
    createdByUserId: "seed",
    updatedByUserId: "seed",
    email: `${id}@example.com`,
    displayName: id,
    role,
    status: "active",
    clientOrganizationId: null,
    contractorOrganizationId: null,
    locationIds: [],
    lastLoginAt: null,
    ...overrides,
  };
}

function auditContext(role, userId) {
  return {
    organizationId: "org-1",
    actor: {
      role,
      userId,
    },
  };
}

function actor(role, userId) {
  if (role === USER_ROLES.ContractorUser) {
    return {
      actorType: "contractor",
      userId,
      role,
      scope: {
        kind: "contractor",
        organizationId: "org-1",
        contractorOrganizationId: "contractor-org-1",
      },
    };
  }

  return {
    actorType: role === USER_ROLES.ClientUser ? "client" : "internal",
    userId,
    role,
    scope:
      role === USER_ROLES.ClientUser
        ? {
            kind: "client",
            organizationId: "org-1",
            clientOrganizationId: "client-1",
            locationAccess: { kind: "all_client_locations" },
          }
        : {
            kind: "internal",
            organizationId: "org-1",
          },
  };
}
