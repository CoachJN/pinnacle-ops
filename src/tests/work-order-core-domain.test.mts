import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createWorkOrderAttachmentMetadataSchema,
  createWorkOrderNoteSchema,
  createWorkOrderSchema,
  getAllowedNextWorkOrderStatuses,
  getWorkOrderCategoryLabel,
  getWorkOrderPriorityLabel,
  getWorkOrderStatusLabel,
  isWorkOrderStatusTransitionAllowed,
  workOrderListQuerySchema,
} from "../modules/work-orders/index.ts";

describe("phase 3 work order domain foundation", () => {
  test("exposes stable display labels", () => {
    assert.equal(getWorkOrderStatusLabel("IN_PROGRESS"), "In Progress");
    assert.equal(getWorkOrderPriorityLabel("URGENT"), "Urgent");
    assert.equal(getWorkOrderCategoryLabel("GENERAL_REPAIR"), "General Repair");
  });

  test("validates create-work-order payloads", () => {
    const result = createWorkOrderSchema.parse({
      title: "Replace failed rooftop capacitor",
      description: "Diagnose the rooftop unit and replace the failed capacitor.",
      clientOrganizationId: "client-1",
      locationId: "location-1",
      priority: "HIGH",
      category: "HVAC",
      requestedByName: "Jordan Lee",
      requestedByEmail: "jordan@example.com",
      requestedByPhone: "555-123-4567",
      source: "CLIENT_PORTAL",
      createdByUserId: "user-1",
      assignedCoordinatorUserId: "user-2",
      assignedManagerUserId: "user-3",
      dueDate: "2026-04-20T16:00:00.000Z",
    });

    assert.equal(result.priority, "HIGH");
    assert.equal(result.requestedByEmail, "jordan@example.com");
  });

  test("rejects invalid create-work-order payloads", () => {
    assert.throws(
      () =>
        createWorkOrderSchema.parse({
          title: "No",
          description: "short",
          clientOrganizationId: "client-1",
          locationId: "location-1",
          priority: "HIGH",
          category: "HVAC",
          requestedByName: "Jordan Lee",
          requestedByEmail: "not-an-email",
          source: "CLIENT_PORTAL",
          createdByUserId: "user-1",
        }),
    );

    assert.throws(
      () =>
        createWorkOrderSchema.parse({
          title: "Replace failed rooftop capacitor",
          description:
            "Diagnose the rooftop unit and replace the failed capacitor.",
          clientOrganizationId: "client-1",
          locationId: "location-1",
          priority: "HIGH",
          category: "HVAC",
          requestedByName: "Jordan Lee",
          source: "CLIENT_PORTAL",
          createdByUserId: "user-1",
          dueDate: "not-a-date",
        }),
    );
  });

  test("validates trimmed note and attachment metadata payloads", () => {
    const note = createWorkOrderNoteSchema.parse({
      body: "  Technician is waiting on access approval.  ",
      createdByUserId: "user-1",
    });
    const attachment = createWorkOrderAttachmentMetadataSchema.parse({
      fileName: "estimate.pdf",
      contentType: "application/pdf",
      sizeBytes: 2048,
      storagePath: "work-orders/wo-1/estimate.pdf",
      uploadedBy: "user-1",
    });

    assert.equal(note.body, "Technician is waiting on access approval.");
    assert.equal(attachment.sizeBytes, 2048);

    assert.throws(() =>
      createWorkOrderNoteSchema.parse({
        body: "   ",
        createdByUserId: "user-1",
      }),
    );
  });

  test("validates list query filters", () => {
    const query = workOrderListQuerySchema.parse({
      status: "OPEN",
      priority: "MEDIUM",
      category: "GENERAL_REPAIR",
      source: "MANUAL",
      clientOrganizationId: "client-1",
      locationId: "location-1",
      assignedCoordinatorUserId: "user-2",
      assignedManagerUserId: "user-3",
      requestedByEmail: "ops@example.com",
      dueDateFrom: "2026-04-14T00:00:00.000Z",
      dueDateTo: "2026-04-30T00:00:00.000Z",
      search: "roof leak",
      isArchived: false,
      limit: 25,
      cursor: "cursor-1",
    });

    assert.equal(query.limit, 25);
    assert.equal(query.status, "OPEN");
  });

  test("enforces the allowed status transition map", () => {
    assert.deepEqual(getAllowedNextWorkOrderStatuses("NEW"), [
      "OPEN",
      "CANCELLED",
    ]);
    assert.equal(isWorkOrderStatusTransitionAllowed("OPEN", "IN_PROGRESS"), true);
    assert.equal(isWorkOrderStatusTransitionAllowed("NEW", "IN_PROGRESS"), false);
    assert.equal(isWorkOrderStatusTransitionAllowed("COMPLETED", "CANCELLED"), false);
    assert.equal(isWorkOrderStatusTransitionAllowed("CANCELLED", "OPEN"), false);
    assert.deepEqual(getAllowedNextWorkOrderStatuses("CLOSED"), []);
  });
});
