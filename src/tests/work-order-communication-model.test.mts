import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWorkOrderCommunicationTimeline,
  deriveWorkOrderFollowUpSnapshot,
  deriveWorkOrderCommunicationSummary,
  filterWorkOrderCommunicationItems,
  isCommunicationTimelineEntry,
} from "@/components/work-orders/work-order-communication-model";

const NOW = "2026-05-08T12:00:00.000Z";

test("communication summary handles no communications", () => {
  const result = deriveWorkOrderCommunicationSummary({
    assignedContractorLabel: "Unassigned",
    assignments: [],
    communications: [],
    notes: [],
    now: NOW,
    timeline: [],
  });

  assert.equal(result.totalCommunicationCount, 0);
  assert.equal(result.status, "No communications recorded yet");
  assert.equal(result.hasGapWarning, true);
});

test("communication summary recognizes internal notes only", () => {
  const result = deriveWorkOrderCommunicationSummary({
    assignedContractorLabel: "Unassigned",
    assignments: [],
    communications: [],
    notes: [
      {
        id: "note-1",
        authorDisplayName: "Jordan Ops",
        body: "Called site contact and waiting on approval.",
        createdAt: "2026-05-08T10:00:00.000Z",
        updatedAt: "2026-05-08T10:00:00.000Z",
      },
    ],
    now: NOW,
    timeline: [],
  });

  assert.equal(result.lastInternalNoteAt, "2026-05-08T10:00:00.000Z");
  assert.equal(result.lastClientVisibleCommunicationAt, null);
  assert.equal(result.status, "Recent internal activity only");
  assert.ok(result.guidance.includes("Recent internal activity only"));
});

test("communication summary recognizes client-visible communication", () => {
  const result = deriveWorkOrderCommunicationSummary({
    assignedContractorLabel: "Unassigned",
    assignments: [],
    communications: [
      buildCommunication({
        id: "message-1",
        createdAt: "2026-05-08T09:00:00.000Z",
        visibility: ["client"],
      }),
    ],
    notes: [],
    now: NOW,
    timeline: [],
  });

  assert.equal(result.lastClientVisibleCommunicationAt, "2026-05-08T09:00:00.000Z");
  assert.equal(result.hasGapWarning, false);
  assert.equal(result.status, "Communication activity is current");
});

test("communication summary recognizes contractor-visible communication", () => {
  const result = deriveWorkOrderCommunicationSummary({
    assignedContractorLabel: "North Mechanical",
    assignments: [],
    communications: [
      buildCommunication({
        id: "message-1",
        createdAt: "2026-05-08T09:00:00.000Z",
        visibility: ["contractor"],
      }),
    ],
    notes: [],
    now: NOW,
    timeline: [],
  });

  assert.equal(
    result.lastContractorVisibleCommunicationAt,
    "2026-05-08T09:00:00.000Z",
  );
  assert.equal(result.hasGapWarning, false);
});

test("communication summary flags stale communication gaps", () => {
  const result = deriveWorkOrderCommunicationSummary({
    assignedContractorLabel: "North Mechanical",
    assignments: [],
    communications: [
      buildCommunication({
        id: "message-1",
        createdAt: "2026-05-01T09:00:00.000Z",
        visibility: ["client"],
      }),
    ],
    notes: [],
    now: NOW,
    staleAfterDays: 3,
    timeline: [],
  });

  assert.equal(result.hasGapWarning, true);
  assert.match(result.gapWarning ?? "", /No communication has been recorded in 7 days/);
});

test("communication summary treats recent activity as current", () => {
  const result = deriveWorkOrderCommunicationSummary({
    assignedContractorLabel: "Unassigned",
    assignments: [],
    communications: [
      buildCommunication({
        id: "message-1",
        createdAt: "2026-05-07T11:30:00.000Z",
        visibility: ["client"],
      }),
    ],
    notes: [],
    now: NOW,
    staleAfterDays: 3,
    timeline: [],
  });

  assert.equal(result.hasGapWarning, false);
  assert.equal(result.status, "Communication activity is current");
});

test("communication timeline keeps mixed sources in reverse chronological order", () => {
  const result = buildWorkOrderCommunicationTimeline({
    assignments: [
      {
        id: "assignment-1",
        assigneeDisplayName: "North Mechanical",
        assignedAt: "2026-05-08T07:00:00.000Z",
        notes: "Arrive with roof access badge.",
      },
    ],
    communications: [
      buildCommunication({
        id: "message-1",
        createdAt: "2026-05-08T10:00:00.000Z",
        visibility: ["client"],
      }),
    ],
    notes: [
      {
        id: "note-1",
        authorDisplayName: "Jordan Ops",
        body: "Internal follow-up",
        createdAt: "2026-05-08T08:00:00.000Z",
        updatedAt: "2026-05-08T08:00:00.000Z",
      },
    ],
    timeline: [
      {
        id: "event-1",
        occurredAt: "2026-05-08T09:00:00.000Z",
        type: "client_communication_logged",
        summary: "Client update sent",
        actor: {
          actorType: "user",
          displayName: "Taylor Manager",
        },
        entity: {
          entityType: "work_order",
          label: "Assigned",
        },
      },
    ],
  });

  assert.deepEqual(result.slice(0, 5).map((item) => item.id), [
    "message-message-1",
    "timeline-event-1",
    "note-note-1",
    "assignment-assignment-1",
  ]);
});

test("communication timeline falls back unknown communication visibility to system", () => {
  const result = buildWorkOrderCommunicationTimeline({
    assignments: [],
    communications: [
      buildCommunication({
        id: "message-1",
        createdAt: "2026-05-08T10:00:00.000Z",
        direction: "mystery",
        visibility: ["finance"],
      }),
    ],
    notes: [],
    timeline: [],
  });

  assert.equal(result[0]?.audience, "system");
  assert.equal(result[0]?.badgeLabel, "System");
});

test("communication summary counts communication-relevant records only", () => {
  const result = deriveWorkOrderCommunicationSummary({
    assignedContractorLabel: "North Mechanical",
    assignments: [
      {
        id: "assignment-1",
        assigneeDisplayName: "North Mechanical",
        assignedAt: "2026-05-08T06:00:00.000Z",
        notes: "Bring roof access badge.",
      },
    ],
    communications: [
      buildCommunication({
        id: "message-1",
        createdAt: "2026-05-08T09:00:00.000Z",
        visibility: ["client"],
      }),
    ],
    notes: [
      {
        id: "note-1",
        authorDisplayName: "Jordan Ops",
        body: "Internal handoff note",
        createdAt: "2026-05-08T07:00:00.000Z",
        updatedAt: "2026-05-08T07:00:00.000Z",
      },
    ],
    now: NOW,
    timeline: [
      {
        id: "event-1",
        occurredAt: "2026-05-08T08:00:00.000Z",
        type: "client_communication_logged",
        summary: "Client update sent",
        actor: {
          actorType: "user",
          displayName: "Jordan Ops",
        },
        entity: {
          entityType: "work_order",
          label: "Client",
        },
      },
      {
        id: "event-2",
        occurredAt: "2026-05-08T05:00:00.000Z",
        type: "status_changed",
        summary: "Status changed",
        actor: {
          actorType: "user",
          displayName: "Jordan Ops",
        },
        entity: {
          entityType: "work_order",
          label: "Assigned",
        },
      },
    ],
  });

  assert.equal(result.totalCommunicationCount, 4);
});

test("communication timeline filters non-communication timeline events", () => {
  const result = buildWorkOrderCommunicationTimeline({
    assignments: [],
    communications: [],
    notes: [],
    timeline: [
      {
        id: "event-1",
        occurredAt: "2026-05-08T10:00:00.000Z",
        type: "status_changed",
        summary: "Status changed",
        actor: {
          actorType: "user",
          displayName: "Jordan Ops",
        },
        entity: {
          entityType: "work_order",
          label: "Assigned",
        },
      },
      {
        id: "event-2",
        occurredAt: "2026-05-08T09:00:00.000Z",
        type: "invoice_sent",
        summary: "Invoice sent to client",
        actor: {
          actorType: "system",
          displayName: null,
        },
        entity: {
          entityType: "invoice",
          label: "INV-1001",
        },
      },
    ],
  });

  assert.deepEqual(result.map((item) => item.id), ["timeline-event-2"]);
  assert.equal(result[0]?.audience, "client");
});

test("communication timeline filter returns audience-specific items", () => {
  const items = buildWorkOrderCommunicationTimeline({
    assignments: [],
    communications: [
      buildCommunication({
        id: "message-client",
        createdAt: "2026-05-08T10:00:00.000Z",
        visibility: ["client"],
      }),
      buildCommunication({
        id: "message-contractor",
        createdAt: "2026-05-08T09:00:00.000Z",
        visibility: ["contractor"],
      }),
    ],
    notes: [],
    timeline: [],
  });

  assert.equal(filterWorkOrderCommunicationItems(items, "client").length, 1);
  assert.equal(filterWorkOrderCommunicationItems(items, "contractor").length, 1);
});

test("follow-up snapshot flags stale communication and missing audiences", () => {
  const items = buildWorkOrderCommunicationTimeline({
    assignments: [],
    communications: [
      buildCommunication({
        id: "message-1",
        createdAt: "2026-05-01T09:00:00.000Z",
        visibility: ["internal"],
        direction: "internal",
      }),
    ],
    notes: [],
    timeline: [],
  });

  const result = deriveWorkOrderFollowUpSnapshot({
    assignedContractorLabel: "North Mechanical",
    items,
    now: NOW,
    staleAfterDays: 3,
  });

  assert.equal(result.status, "Follow-up stale");
  assert.ok(result.guidance.includes("Last communication was 7 days ago"));
  assert.ok(result.guidance.includes("Client update may be needed"));
  assert.ok(result.guidance.includes("Contractor follow-up may be needed"));
});

test("follow-up snapshot recognizes recent communication", () => {
  const items = buildWorkOrderCommunicationTimeline({
    assignments: [],
    communications: [
      buildCommunication({
        id: "message-1",
        createdAt: "2026-05-08T11:00:00.000Z",
        visibility: ["client"],
      }),
    ],
    notes: [],
    timeline: [],
  });

  const result = deriveWorkOrderFollowUpSnapshot({
    assignedContractorLabel: "Unassigned",
    items,
    now: NOW,
    staleAfterDays: 3,
  });

  assert.equal(result.status, "Communication is current");
  assert.ok(result.guidance.includes("Communication is current"));
});

test("communication timeline keyword detection covers unknown fallback safely", () => {
  assert.equal(
    isCommunicationTimelineEntry({
      id: "event-1",
      occurredAt: "2026-05-08T10:00:00.000Z",
      type: "portal_message_logged",
      summary: "Portal message logged",
      actor: {
        actorType: "system",
        displayName: null,
      },
      entity: {
        entityType: "communication",
        label: null,
      },
    }),
    true,
  );
});

function buildCommunication(input: {
  id: string;
  createdAt: string;
  direction?: string;
  visibility: string[];
}) {
  return {
    id: input.id,
    threadId: "thread-1",
    messageId: input.id,
    workOrderId: "work-order-1",
    channel: "portal_message",
    direction: input.direction ?? "outbound",
    visibility: input.visibility,
    subject: "Update",
    body: "Recorded communication body.",
    plainTextBody: "Recorded communication body.",
    createdAt: input.createdAt,
    sentAt: input.createdAt,
    actor: {
      actorType: "user",
      displayName: "Jordan Ops",
    },
    attachments: [],
    relatedEventIds: [],
    linkedEntityIds: ["work-order-1"],
  };
}
