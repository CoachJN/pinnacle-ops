import assert from "node:assert/strict";
import test from "node:test";

import { createAssignmentService } from "../server/services/assignment-service.ts";
import type { ActivityLogService } from "../server/services/activity-log-service.ts";
import {
  getContractorPortalActionAvailability,
  toContractorPortalWorkOrderDetail,
} from "../modules/work-orders/contractor-portal.ts";
import type {
  Assignment,
  AssignmentRepository,
  ContractorOrganizationRepository,
  Location,
  Quote,
  UserProfile,
  UserProfileRepository,
  WorkOrder,
  WorkOrderRepository,
} from "../server/repositories/index.ts";
import { USER_ROLES } from "../types/permissions.ts";
import type { EntityId } from "../types/entity.ts";

test("contractor portal projection stays contractor-safe", () => {
  const detail = toContractorPortalWorkOrderDetail({
    workOrder: makeWorkOrder(),
    assignment: makeAssignment(),
    quote: makeQuote(),
    location: makeLocation(),
    visibleActivity: [
      {
        id: "activity-1",
        message: "Quote submitted for review.",
        createdAt: "2026-04-14T11:00:00.000Z",
        actorLabel: "Contractor",
      },
    ],
  });

  assert.equal("assignedCoordinatorUserId" in detail, false);
  assert.equal("internalNotes" in detail, false);
  assert.equal(detail.locationContactName, "Avery Hill");
  assert.equal(detail.quote?.status, "draft");
  assert.equal(detail.actionAvailability.canSubmitQuote, true);
});

test("contractor action availability blocks quote submission after decline", () => {
  const availability = getContractorPortalActionAvailability({
    workOrder: makeWorkOrder({ status: "quote_requested" }),
    assignment: makeAssignment({ status: "declined" }),
    quote: null,
  });

  assert.equal(availability.canAcceptAssignment, false);
  assert.equal(availability.canDeclineAssignment, false);
  assert.equal(availability.canSubmitQuote, false);
});

test("assignment service blocks contractor completion outside their organization", async () => {
  const harness = createAssignmentHarness({
    profile: makeUserProfile({ contractorOrganizationId: "contractor-1" }),
    assignment: makeAssignment({
      status: "accepted",
      contractorOrganizationId: "contractor-2",
    }),
  });

  const result = await harness.service.updateStatus({
    organizationId: "org-1",
    actor: {
      userId: "contractor-user-1",
      role: USER_ROLES.ContractorUser,
    },
    workOrderId: harness.workOrder.id,
    assignmentId: harness.assignment.id,
    status: "completed",
  });

  assert.equal(result.ok, false);
});

test("assignment service allows contractor completion for matching organization and records contractor visibility", async () => {
  const harness = createAssignmentHarness();

  const result = await harness.service.updateStatus({
    organizationId: "org-1",
    actor: {
      userId: "contractor-user-1",
      role: USER_ROLES.ContractorUser,
    },
    workOrderId: harness.workOrder.id,
    assignmentId: harness.assignment.id,
    status: "completed",
  });

  assert.equal(result.ok, true);
  assert.equal(harness.assignmentStore.get(harness.assignment.id)?.status, "completed");
  assert.equal(harness.recordedActivity.at(-1)?.visibility, "contractor");
});

function createAssignmentHarness(input: {
  workOrder?: WorkOrder;
  assignment?: Assignment;
  profile?: UserProfile;
} = {}) {
  const workOrder = input.workOrder ?? makeWorkOrder({ status: "in_progress" });
  const assignment = input.assignment ?? makeAssignment({ status: "accepted" });
  const profile =
    input.profile ?? makeUserProfile({ contractorOrganizationId: "contractor-1" });
  const workOrderStore = new Map<EntityId, WorkOrder>([[workOrder.id, workOrder]]);
  const assignmentStore = new Map<EntityId, Assignment>([[assignment.id, assignment]]);
  const recordedActivity: Array<{ visibility?: string }> = [];

  const workOrders: Pick<WorkOrderRepository, "getById" | "save"> = {
    async getById(id) {
      return workOrderStore.get(id) ?? null;
    },
    async save(entity) {
      workOrderStore.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
  };

  const assignments: Pick<
    AssignmentRepository,
    "getById" | "save" | "newId" | "getActiveByWorkOrderId" | "listByWorkOrderId" | "create"
  > = {
    newId() {
      return "assignment-new";
    },
    async getById(id) {
      return assignmentStore.get(id) ?? null;
    },
    async save(entity) {
      assignmentStore.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
    async create(entity) {
      assignmentStore.set(entity.id, entity);
      return { id: entity.id, item: entity };
    },
    async getActiveByWorkOrderId(workOrderId) {
      return (
        [...assignmentStore.values()].find(
          (entity) =>
            entity.workOrderId === workOrderId &&
            (entity.status === "assigned" || entity.status === "accepted"),
        ) ?? null
      );
    },
    async listByWorkOrderId(workOrderId) {
      const items = [...assignmentStore.values()].filter(
        (entity) => entity.workOrderId === workOrderId,
      );
      return { items, count: items.length };
    },
  };

  const userProfiles: Pick<UserProfileRepository, "getById"> = {
    async getById(id) {
      return id === profile.id ? profile : null;
    },
  };

  const contractorOrganizations: Pick<
    ContractorOrganizationRepository,
    "getById" | "listByOrganizationId"
  > = {
    async getById() {
      return null;
    },
    async listByOrganizationId() {
      return { items: [], count: 0 };
    },
  };

  const activityLogs: ActivityLogService = {
    async listForWorkOrder() {
      return { ok: true, value: [] };
    },
    async record(input) {
      recordedActivity.push({ visibility: input.visibility });
      return { ok: true, value: null as never };
    },
  };

  return {
    workOrder,
    assignment,
    assignmentStore,
    recordedActivity,
    service: createAssignmentService(
      {
        assignments: assignments as AssignmentRepository,
        workOrders: workOrders as WorkOrderRepository,
        contractorOrganizations: contractorOrganizations as ContractorOrganizationRepository,
        userProfiles: userProfiles as UserProfileRepository,
      },
      { activityLogs },
    ),
  };
}

function makeWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: "wo-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-14T10:00:00.000Z",
    updatedAt: "2026-04-14T10:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderNumber: "WO-1001",
    title: "Generator repair",
    description: "Repair transfer switch and verify operation.",
    status: "quote_requested",
    priority: "high",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    requestedByUserId: "user-1",
    assignedCoordinatorUserId: "coord-1",
    assignedManagerUserId: "mgr-1",
    assignedContractorOrganizationId: "contractor-1",
    currentQuoteId: "quote-1",
    currentInvoiceId: null,
    clientSnapshot: { id: "client-1", name: "Northwind" },
    locationSnapshot: { id: "loc-1", name: "Northwind HQ", addressText: "100 King Street" },
    contractorSnapshot: { id: "contractor-1", name: "Field Ops" },
    category: "electrical",
    requestedServiceDate: "2026-04-15T14:00:00.000Z",
    submittedAt: null,
    approvedAt: null,
    completedAt: null,
    closedAt: null,
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<Assignment> = {}): Assignment {
  return {
    id: "assignment-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-14T10:00:00.000Z",
    updatedAt: "2026-04-14T10:00:00.000Z",
    createdByUserId: "manager-1",
    updatedByUserId: "manager-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderId: "wo-1",
    contractorOrganizationId: "contractor-1",
    assigneeType: "contractor",
    assigneeUserId: "contractor-user-1",
    assigneeOrganizationId: "contractor-1",
    assignedByUserId: "manager-1",
    status: "assigned",
    scheduledDate: null,
    timeWindowStart: null,
    timeWindowEnd: null,
    assignedAt: "2026-04-14T10:00:00.000Z",
    acceptedAt: null,
    declinedAt: null,
    completedAt: null,
    notes: null,
    workOrderSnapshot: { id: "wo-1", name: "WO-1001" },
    contractorSnapshot: { id: "contractor-1", name: "Field Ops" },
    ...overrides,
  };
}

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "quote-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-14T10:30:00.000Z",
    updatedAt: "2026-04-14T10:30:00.000Z",
    createdByUserId: "contractor-user-1",
    updatedByUserId: "contractor-user-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderId: "wo-1",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    contractorOrganizationId: "contractor-1",
    versionNumber: 1,
    status: "draft",
    laborAmount: 1000,
    materialAmount: 250,
    otherAmount: 0,
    totalAmount: 1250,
    currency: "USD",
    scopeSummary: "Replace the failed transfer switch hardware.",
    contractorNotes: "Material can arrive next morning.",
    internalReviewNotes: "Do not expose",
    clientResponseNotes: null,
    submittedByUserId: null,
    submittedAt: null,
    reviewedAt: null,
    clientDecisionAt: null,
    workOrderSnapshot: { id: "wo-1", name: "WO-1001" },
    contractorSnapshot: { id: "contractor-1", name: "Field Ops" },
    ...overrides,
  };
}

function makeLocation(overrides: Partial<Location> = {}): Location {
  return {
    id: "loc-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-14T09:00:00.000Z",
    updatedAt: "2026-04-14T09:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    deletedAt: null,
    deletedByUserId: null,
    clientOrganizationId: "client-1",
    clientSnapshot: { id: "client-1", name: "Northwind" },
    name: "Northwind HQ",
    code: "HQ",
    status: "active",
    addressLine1: "100 King Street",
    addressLine2: null,
    city: "Toronto",
    region: "ON",
    postalCode: "M5H 1J9",
    countryCode: "CA",
    locationContactName: "Avery Hill",
    locationContactEmail: "avery@example.com",
    locationContactPhone: "555-0119",
    accessNotes: "Check in with building security on arrival.",
    notes: "Internal-only dock code.",
    ...overrides,
  };
}

function makeUserProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: "contractor-user-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-14T09:00:00.000Z",
    updatedAt: "2026-04-14T09:00:00.000Z",
    createdByUserId: "owner-1",
    updatedByUserId: "owner-1",
    deletedAt: null,
    deletedByUserId: null,
    email: "contractor@example.com",
    displayName: "Contractor User",
    role: USER_ROLES.ContractorUser,
    status: "active",
    clientOrganizationId: null,
    contractorOrganizationId: "contractor-1",
    locationIds: [],
    lastLoginAt: null,
    ...overrides,
  };
}
