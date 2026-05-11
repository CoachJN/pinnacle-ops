import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWorkOrderRecentActivitySnapshot,
  deriveWorkOrderOperationalSummary,
} from "@/components/work-orders/work-order-display-model";

const NOW = "2026-05-08T12:00:00.000Z";

test("derived summary flags unassigned work orders conservatively", () => {
  const result = deriveWorkOrderOperationalSummary({
    activeAssignmentStatus: null,
    assignedContractorLabel: "Unassigned",
    coordinatorLabel: "Jordan Ops",
    createdAt: "2026-05-06T12:00:00.000Z",
    dueDate: null,
    closedAt: null,
    managerLabel: "Taylor Manager",
    now: NOW,
    requiresQuote: false,
    status: "assigned",
  });

  assert.equal(result.nextAction.label, "Assign a contractor");
  assert.equal(result.ownershipWarning, "Missing contractor assignment.");
});

test("derived summary marks overdue open work orders", () => {
  const result = deriveWorkOrderOperationalSummary({
    activeAssignmentStatus: "accepted",
    assignedContractorLabel: "North Mechanical",
    coordinatorLabel: "Jordan Ops",
    createdAt: "2026-05-01T12:00:00.000Z",
    dueDate: "2026-05-03T12:00:00.000Z",
    closedAt: null,
    managerLabel: "Taylor Manager",
    now: NOW,
    requiresQuote: false,
    status: "in_progress",
  });

  assert.equal(result.isOverdue, true);
  assert.equal(result.nextAction.label, "Overdue");
  assert.equal(result.riskLabel, "Overdue");
});

test("derived summary surfaces quote required guidance", () => {
  const result = deriveWorkOrderOperationalSummary({
    activeAssignmentStatus: null,
    assignedContractorLabel: "Unassigned",
    coordinatorLabel: "Jordan Ops",
    createdAt: "2026-05-05T12:00:00.000Z",
    dueDate: null,
    closedAt: null,
    managerLabel: "Taylor Manager",
    now: NOW,
    requiresQuote: true,
    status: "quote_required",
  });

  assert.equal(result.nextAction.label, "Quote required");
});

test("derived summary treats closed work orders as no longer blocked", () => {
  const result = deriveWorkOrderOperationalSummary({
    activeAssignmentStatus: "completed",
    assignedContractorLabel: "North Mechanical",
    coordinatorLabel: "Jordan Ops",
    createdAt: "2026-05-01T12:00:00.000Z",
    dueDate: "2026-05-03T12:00:00.000Z",
    closedAt: "2026-05-04T12:00:00.000Z",
    managerLabel: "Taylor Manager",
    now: NOW,
    requiresQuote: false,
    status: "closed",
  });

  assert.equal(result.isClosed, true);
  assert.equal(result.nextAction.label, "No current blocker");
  assert.equal(result.ownershipWarning, null);
});

test("derived summary avoids contractor assignment warnings when coverage exists", () => {
  const result = deriveWorkOrderOperationalSummary({
    activeAssignmentStatus: "accepted",
    assignedContractorLabel: "North Mechanical",
    coordinatorLabel: "Jordan Ops",
    createdAt: "2026-05-06T12:00:00.000Z",
    dueDate: null,
    closedAt: null,
    managerLabel: "Taylor Manager",
    now: NOW,
    requiresQuote: false,
    status: "assigned",
  });

  assert.equal(result.ownershipWarning, null);
});

test("recent activity helper returns empty state source when no records exist", () => {
  const result = buildWorkOrderRecentActivitySnapshot({
    assignments: [],
    attachments: [],
    notes: [],
    timeline: [],
  });

  assert.deepEqual(result, []);
});

test("recent activity helper orders newest timeline activity first", () => {
  const result = buildWorkOrderRecentActivitySnapshot({
    assignments: [],
    attachments: [],
    notes: [],
    timeline: [
      {
        id: "event-1",
        occurredAt: "2026-05-07T09:00:00.000Z",
        type: "note_added",
        summary: "Note added",
        actor: {
          actorType: "user",
          displayName: "Jordan Ops",
        },
        entity: {
          entityType: "note",
          label: null,
        },
      },
      {
        id: "event-2",
        occurredAt: "2026-05-08T09:00:00.000Z",
        type: "communication_message_created",
        summary: "Client email linked",
        actor: {
          actorType: "user",
          displayName: "Taylor Manager",
        },
        entity: {
          entityType: "communication_message",
          label: "Inbound email",
        },
      },
    ],
  });

  assert.equal(result[0]?.id, "event-2");
  assert.equal(result[0]?.targetTab, "communications");
  assert.equal(result[1]?.id, "event-1");
  assert.equal(result[1]?.targetTab, "communications");
});

test("recent activity helper routes attachments to files and lifecycle events to history", () => {
  const result = buildWorkOrderRecentActivitySnapshot({
    assignments: [],
    attachments: [
      {
        id: "attachment-1",
        createdAt: "2026-05-08T08:00:00.000Z",
        fileName: "site-photo.jpg",
        uploadedByDisplayName: "Jordan Ops",
      },
    ],
    notes: [],
    timeline: [
      {
        id: "event-1",
        occurredAt: "2026-05-08T09:00:00.000Z",
        type: "status_changed",
        summary: "Moved to in progress",
        actor: {
          actorType: "user",
          displayName: "Taylor Manager",
        },
        entity: {
          entityType: "work_order",
          label: "In Progress",
        },
      },
      {
        id: "event-2",
        occurredAt: "2026-05-08T10:00:00.000Z",
        type: "attachment_added",
        summary: "Attachment added",
        actor: {
          actorType: "user",
          displayName: "Jordan Ops",
        },
        entity: {
          entityType: "attachment",
          label: "site-photo.jpg",
        },
      },
    ],
  });

  assert.equal(result[0]?.targetTab, "files");
  assert.equal(result[1]?.targetTab, "history-audit");
});
