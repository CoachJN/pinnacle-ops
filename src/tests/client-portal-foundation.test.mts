import assert from "node:assert/strict";
import test from "node:test";

import { safeLocationDetailForActor } from "../server/api/business-entities.ts";
import { canViewWorkOrder } from "../server/authorization/work-order.permissions.ts";
import { toClientPortalLocationDetail } from "../modules/locations/client-portal.ts";
import { toClientPortalWorkOrderDetail } from "../modules/work-orders/client-portal.ts";
import type {
  ClientQuote,
  Location,
  WorkOrder,
} from "../server/repositories/index.ts";
import type { WorkOrderDetailDto } from "../lib/services/work-orders/index.ts";
import type { ClientAccessActor } from "../types/auth.ts";
import { USER_ROLES } from "../types/permissions.ts";

test("client portal location projection omits internal notes", () => {
  const detail = toClientPortalLocationDetail(makeLocation());

  assert.equal("notes" in detail, false);
  assert.equal(detail.accessNotes, "Escort required after 5 p.m.");
});

test("shared location serializer redacts internal notes for client actors", () => {
  const detail = safeLocationDetailForActor(makeClientActor(), makeLocation());

  assert.equal(detail.notes, undefined);
  assert.equal(detail.recordStatus, undefined);
});

test("client work order visibility respects selected location scope", () => {
  const actor = makeClientActor({ locationIds: ["loc-1"] });

  assert.equal(
    canViewWorkOrder(actor, {
      id: "wo-1",
      organizationId: "org-1",
      clientOrganizationId: "client-1",
      locationId: "loc-1",
      status: "submitted",
    }),
    true,
  );
  assert.equal(
    canViewWorkOrder(actor, {
      id: "wo-2",
      organizationId: "org-1",
      clientOrganizationId: "client-1",
      locationId: "loc-2",
      status: "submitted",
    }),
    false,
  );
});

test("client work order projection omits internal collaboration fields", () => {
  const projected = toClientPortalWorkOrderDetail(
    makeWorkOrderDetailDto(),
    makeWorkOrder(),
    makeClientQuote(),
  );

  assert.equal("notes" in projected, false);
  assert.equal("attachments" in projected, false);
  assert.equal(projected.activeQuote?.status, "sent");
});

function makeClientActor(
  options: {
    locationIds?: string[];
  } = {},
): ClientAccessActor {
  return {
    actorType: "client",
    userId: "client-user-1",
    role: USER_ROLES.ClientUser,
    scope: {
      kind: "client",
      organizationId: "org-1",
      clientOrganizationId: "client-1",
      locationAccess: options.locationIds
        ? {
            kind: "selected_client_locations",
            locationIds: options.locationIds,
          }
        : {
            kind: "all_client_locations",
          },
    },
  };
}

function makeLocation(): Location {
  return {
    id: "loc-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-12T10:00:00.000Z",
    updatedAt: "2026-04-12T10:00:00.000Z",
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
    locationContactName: "Alex Rivera",
    locationContactEmail: "alex@example.com",
    locationContactPhone: "555-0100",
    accessNotes: "Escort required after 5 p.m.",
    notes: "Internal gate code is 1234.",
  };
}

function makeWorkOrder(): WorkOrder {
  return {
    id: "wo-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-12T10:00:00.000Z",
    updatedAt: "2026-04-12T10:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderNumber: "WO-1001",
    title: "Generator alarm",
    description: "Investigate generator issue.",
    status: "submitted",
    priority: "medium",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    requestedByUserId: "user-1",
    assignedCoordinatorUserId: "coord-1",
    assignedManagerUserId: "mgr-1",
    assignedContractorOrganizationId: "contractor-1",
    currentQuoteId: "cq-1",
    currentInvoiceId: null,
    clientSnapshot: { id: "client-1", name: "Northwind" },
    locationSnapshot: { id: "loc-1", name: "Northwind HQ", addressText: "100 King Street" },
    contractorSnapshot: { id: "contractor-1", name: "Field Ops" },
    category: "electrical",
    requestedServiceDate: "2026-04-15T14:00:00.000Z",
    submittedAt: "2026-04-12T10:00:00.000Z",
    approvedAt: null,
    completedAt: null,
    closedAt: null,
  };
}

function makeWorkOrderDetailDto(): WorkOrderDetailDto {
  return {
    id: "wo-1",
    workOrderNumber: "WO-1001",
    title: "Generator alarm",
    description: "Investigate generator issue.",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    status: "OPEN",
    priority: "MEDIUM",
    category: "ELECTRICAL",
    requestedByName: "Jordan Lee",
    requestedByEmail: "jordan@example.com",
    requestedByPhone: "555-0111",
    source: "CLIENT_PORTAL",
    createdByUserId: "user-1",
    assignedCoordinatorUserId: "coord-1",
    assignedManagerUserId: "mgr-1",
    dueDate: "2026-04-15T14:00:00.000Z",
    createdAt: "2026-04-12T10:00:00.000Z",
    updatedAt: "2026-04-12T10:00:00.000Z",
    closedAt: null,
    isArchived: false,
    searchText: "generator alarm",
    notes: [],
    attachments: [],
    assignments: [],
    activeAssignment: null,
    allowedNextStatuses: [],
    allowedActions: {
      canUpdateStatus: false,
      canAddNote: false,
      canAddAttachment: false,
      canAssign: false,
      canReassign: false,
      canAcceptAssignment: false,
      canDeclineAssignment: false,
      canCompleteAssignment: false,
    },
  };
}

function makeClientQuote(): ClientQuote {
  return {
    id: "cq-1",
    organizationId: "org-1",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-04-12T11:00:00.000Z",
    updatedAt: "2026-04-12T11:00:00.000Z",
    createdByUserId: "manager-1",
    updatedByUserId: "manager-1",
    deletedAt: null,
    deletedByUserId: null,
    workOrderId: "wo-1",
    sourceContractorQuoteId: null,
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    lineItems: [
      {
        description: "Replace control board",
        quantity: 1,
        unitPrice: 1200,
        lineTotal: 1200,
      },
    ],
    subtotal: 1200,
    taxAmount: 156,
    totalAmount: 1356,
    notes: "Includes testing and commissioning.",
    status: "sent",
    sentAt: "2026-04-12T11:00:00.000Z",
    respondedAt: null,
    approvedAt: null,
    rejectedAt: null,
    rejectionReason: null,
    workOrderSnapshot: { id: "wo-1", name: "WO-1001" },
  };
}
