import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ClientInvoice } from "@/types/invoice";
import {
  buildUnifiedAuditTimeline,
  deriveWorkOrderAuditModel,
  deriveWorkOrderAuditSummary,
  type WorkOrderAuditAssignmentItem,
} from "@/components/work-orders/work-order-audit-model";
import type { WorkOrderCommunicationMessageItem } from "@/components/work-orders/work-order-communication-model";
import type {
  WorkOrderAttachmentSnapshot,
  WorkOrderNoteSnapshot,
  WorkOrderTimelineEntry,
} from "@/components/work-orders/work-order-display-model";
import type {
  ClientQuoteRecord,
  ContractorQuoteRecord,
} from "@/components/work-orders/work-order-financial-model";

describe("buildUnifiedAuditTimeline", () => {
  it("handles no audit events", () => {
    const items = buildUnifiedAuditTimeline(baseInput());

    assert.equal(items.length, 0);
  });

  it("classifies timeline-only workflow events", () => {
    const items = buildUnifiedAuditTimeline(
      baseInput({
        timeline: [
          timelineEntry({
            occurredAt: "2026-05-08T10:00:00.000Z",
            summary: "Status changed to in progress",
            type: "status_changed",
          }),
        ],
      }),
    );

    assert.equal(items[0]?.category, "Workflow");
    assert.equal(items[0]?.sourceType, "timeline");
  });

  it("expands assignment events", () => {
    const items = buildUnifiedAuditTimeline(
      baseInput({
        assignments: [
          assignment({
            acceptedAt: "2026-05-08T11:00:00.000Z",
            completedAt: "2026-05-08T13:00:00.000Z",
          }),
        ],
      }),
    );

    assert.equal(items.filter((item) => item.category === "Assignment").length, 3);
    assert.equal(items[0]?.eventLabel, "Assignment completed");
  });

  it("includes financial events", () => {
    const items = buildUnifiedAuditTimeline(
      baseInput({
        clientQuotes: [clientQuote({ approvedAt: "2026-05-08T12:00:00.000Z", status: "approved" })],
        contractorQuotes: [contractorQuote()],
        invoices: [invoice()],
      }),
    );

    assert.equal(items.filter((item) => item.category === "Finance").length, 3);
  });

  it("includes communication and note events without duplicating canonical note ids", () => {
    const items = buildUnifiedAuditTimeline(
      baseInput({
        communications: [communication({ id: "shared-1" })],
        notes: [
          note({ id: "shared-1" }),
          note({ id: "legacy-1", body: "Legacy note body" }),
        ],
      }),
    );

    assert.equal(items.filter((item) => item.category === "Communication").length, 2);
    assert.equal(items.some((item) => item.id === "note-shared-1"), false);
  });

  it("includes file events", () => {
    const items = buildUnifiedAuditTimeline(
      baseInput({
        attachments: [attachment()],
      }),
    );

    assert.equal(items[0]?.category, "File");
    assert.equal(items[0]?.sourceType, "attachment");
  });

  it("orders mixed categories by newest first", () => {
    const items = buildUnifiedAuditTimeline(
      baseInput({
        attachments: [attachment({ createdAt: "2026-05-08T08:00:00.000Z" })],
        communications: [communication({ createdAt: "2026-05-08T10:00:00.000Z" })],
        invoices: [invoice({ updatedAt: "2026-05-08T12:00:00.000Z" })],
        timeline: [timelineEntry({ occurredAt: "2026-05-08T09:00:00.000Z", type: "status_changed" })],
      }),
    );

    assert.equal(items[0]?.category, "Finance");
    assert.equal(items[1]?.category, "Communication");
    assert.equal(items[2]?.category, "Workflow");
    assert.equal(items[3]?.category, "File");
  });

  it("falls back unknown timeline records to Other", () => {
    const items = buildUnifiedAuditTimeline(
      baseInput({
        timeline: [
          timelineEntry({
            actor: { actorType: "user", displayName: "Analyst" },
            entity: { entityType: "mystery_entity", label: "Odd thing" },
            summary: "Opaque event",
            type: "opaque_event",
          }),
        ],
      }),
    );

    assert.equal(items[0]?.category, "Other");
  });
});

describe("deriveWorkOrderAuditSummary", () => {
  it("derives most recent event and counts by category", () => {
    const timeline = buildUnifiedAuditTimeline(
      baseInput({
        assignments: [assignment()],
        attachments: [attachment()],
        communications: [communication()],
        invoices: [invoice()],
        timeline: [timelineEntry({ occurredAt: "2026-05-08T13:00:00.000Z", type: "status_changed" })],
      }),
    );

    const summary = deriveWorkOrderAuditSummary(timeline);

    assert.equal(summary.totalEvents, 5);
    assert.equal(summary.workflowEventCount, 1);
    assert.equal(summary.assignmentEventCount, 1);
    assert.equal(summary.financialEventCount, 1);
    assert.equal(summary.communicationEventCount, 1);
    assert.equal(summary.fileEventCount, 1);
    assert.equal(summary.mostRecentEventAt, "2026-05-08T13:00:00.000Z");
  });
});

describe("deriveWorkOrderAuditModel", () => {
  it("creates a fallback status history when explicit lifecycle history is missing", () => {
    const model = deriveWorkOrderAuditModel({
      ...baseInput(),
      currentStatus: "assigned",
      updatedAt: "2026-05-08T15:00:00.000Z",
    });

    assert.equal(model.statusHistory.length, 1);
    assert.equal(model.statusHistory[0]?.sourceType, "status_fallback");
  });
});

function baseInput(
  overrides: Partial<Parameters<typeof buildUnifiedAuditTimeline>[0]> = {},
): Parameters<typeof buildUnifiedAuditTimeline>[0] {
  return {
    assignments: [],
    attachments: [],
    clientQuotes: [],
    communications: [],
    contractorQuotes: [],
    invoices: [],
    notes: [],
    timeline: [],
    ...overrides,
  };
}

function assignment(
  overrides: Partial<WorkOrderAuditAssignmentItem> = {},
): WorkOrderAuditAssignmentItem {
  return {
    acceptedAt: null,
    assignedAt: "2026-05-08T09:00:00.000Z",
    assignedByDisplayName: "Dispatcher",
    assigneeDisplayName: "North Crew",
    assigneeType: "contractor",
    completedAt: null,
    declinedAt: null,
    id: "assignment-1",
    notes: "Bring lift key",
    scheduledDate: "2026-05-09",
    status: "assigned",
    timeWindowEnd: "12:00",
    timeWindowStart: "08:00",
    ...overrides,
  };
}

function contractorQuote(
  overrides: Partial<ContractorQuoteRecord> = {},
): ContractorQuoteRecord {
  return {
    createdAt: "2026-05-08T08:00:00.000Z",
    id: "contractor-1",
    lineItems: [],
    notes: null,
    rejectionReason: null,
    reviewedAt: null,
    status: "submitted",
    submittedAt: "2026-05-08T08:30:00.000Z",
    subtotal: 100,
    taxAmount: 0,
    totalAmount: 100,
    updatedAt: "2026-05-08T08:30:00.000Z",
    ...overrides,
  };
}

function clientQuote(overrides: Partial<ClientQuoteRecord> = {}): ClientQuoteRecord {
  return {
    approvedAt: null,
    createdAt: "2026-05-08T09:00:00.000Z",
    id: "client-1",
    lineItems: [],
    notes: null,
    rejectedAt: null,
    rejectionReason: null,
    respondedAt: null,
    sentAt: null,
    sourceContractorQuoteId: "contractor-1",
    status: "draft",
    subtotal: 100,
    taxAmount: 0,
    totalAmount: 100,
    updatedAt: "2026-05-08T09:00:00.000Z",
    ...overrides,
  };
}

function invoice(overrides: Partial<ClientInvoice> = {}): ClientInvoice {
  return {
    clientOrganizationId: "client-org-1",
    createdAt: "2026-05-08T11:00:00.000Z",
    createdByUserId: "user-1",
    currency: "CAD",
    dueDate: "2026-05-15T00:00:00.000Z",
    id: "invoice-1",
    invoiceNumber: "INV-1001",
    isDeleted: false,
    issuedDate: null,
    lineItems: [],
    locationId: "location-1",
    notes: null,
    organizationId: "org-1",
    paidAt: null,
    paymentReference: null,
    qboInvoiceId: null,
    qboSyncStatus: null,
    recordStatus: "active",
    sentAt: null,
    status: "draft",
    subtotal: 100,
    taxAmount: 0,
    totalAmount: 100,
    updatedAt: "2026-05-08T11:00:00.000Z",
    updatedByUserId: "user-1",
    viewedAt: null,
    voidedAt: null,
    workOrderId: "work-order-1",
    ...overrides,
  };
}

function communication(
  overrides: Partial<WorkOrderCommunicationMessageItem> = {},
): WorkOrderCommunicationMessageItem {
  return {
    actor: {
      actorId: "user-2",
      actorRole: "manager",
      actorType: "internal",
      displayName: "Manager",
    },
    attachments: [],
    body: "Client updated on revised arrival window.",
    channel: "portal_message",
    createdAt: "2026-05-08T10:00:00.000Z",
    direction: "outbound",
    id: "communication-1",
    linkedEntityIds: [],
    messageId: "message-1",
    plainTextBody: "Client updated on revised arrival window.",
    relatedEventIds: [],
    sentAt: "2026-05-08T10:05:00.000Z",
    subject: "Arrival update",
    threadId: "thread-1",
    visibility: ["client"],
    workOrderId: "work-order-1",
    ...overrides,
  };
}

function note(overrides: Partial<WorkOrderNoteSnapshot> = {}): WorkOrderNoteSnapshot {
  return {
    authorDisplayName: "Coordinator",
    body: "Internal note",
    createdAt: "2026-05-08T07:00:00.000Z",
    id: "note-1",
    updatedAt: "2026-05-08T07:00:00.000Z",
    ...overrides,
  };
}

function attachment(
  overrides: Partial<WorkOrderAttachmentSnapshot> = {},
): WorkOrderAttachmentSnapshot {
  return {
    createdAt: "2026-05-08T06:00:00.000Z",
    fileName: "site-photo.jpg",
    id: "attachment-1",
    uploadedByDisplayName: "Coordinator",
    ...overrides,
  };
}

function timelineEntry(
  overrides: Partial<WorkOrderTimelineEntry> = {},
): WorkOrderTimelineEntry {
  return {
    actor: {
      actorType: "system",
      displayName: "System",
    },
    entity: {
      entityType: "work_order",
      label: "Work order",
    },
    id: "timeline-1",
    occurredAt: "2026-05-08T09:30:00.000Z",
    summary: "Status changed",
    type: "status_changed",
    ...overrides,
  };
}
