import assert from "node:assert/strict";
import test from "node:test";
import type { WorkOrderStatus } from "@/modules/work-orders";
import {
  buildWorkflowHistorySnapshot,
  deriveWorkOrderWorkflowStage,
  deriveWorkflowActions,
} from "@/components/work-orders/work-order-workflow-model";

test("workflow stage maps new work orders to requested", () => {
  const result = deriveWorkOrderWorkflowStage("new");

  assert.equal(result.currentStageId, "requested");
  assert.equal(result.stages[0]?.state, "current");
});

test("workflow stage maps assigned work orders to assigned", () => {
  const result = deriveWorkOrderWorkflowStage("assigned");

  assert.equal(result.currentStageId, "assigned");
  assert.equal(result.stages[0]?.state, "completed");
  assert.equal(result.stages[1]?.state, "current");
});

test("workflow stage maps quote workflow statuses to quote required", () => {
  const result = deriveWorkOrderWorkflowStage("quote_under_review");

  assert.equal(result.currentStageId, "quote_required");
  assert.equal(result.stages[2]?.state, "current");
});

test("workflow stage maps in progress status to in progress", () => {
  const result = deriveWorkOrderWorkflowStage("in_progress");

  assert.equal(result.currentStageId, "in_progress");
  assert.equal(result.stages[3]?.state, "current");
});

test("workflow stage marks on hold work orders as blocked", () => {
  const result = deriveWorkOrderWorkflowStage("on_hold");

  assert.equal(result.currentStageId, "exception");
  assert.equal(result.isException, true);
  assert.equal(result.stages[4]?.state, "current");
  assert.equal(result.stages[5]?.state, "blocked");
});

test("workflow stage marks escalated work orders as blocked", () => {
  const result = deriveWorkOrderWorkflowStage("escalated");

  assert.equal(result.currentStageId, "exception");
  assert.equal(result.stages[4]?.state, "current");
  assert.equal(result.stages[6]?.state, "blocked");
});

test("workflow stage maps completed work into completion review", () => {
  const result = deriveWorkOrderWorkflowStage("work_completed");

  assert.equal(result.currentStageId, "completion_review");
  assert.equal(result.stages[5]?.state, "current");
});

test("workflow stage maps ready for invoicing status correctly", () => {
  const result = deriveWorkOrderWorkflowStage("ready_for_invoicing");

  assert.equal(result.currentStageId, "ready_for_invoicing");
  assert.equal(result.stages[6]?.state, "current");
});

test("workflow stage maps cancelled and closed to final stage", () => {
  const closedResult = deriveWorkOrderWorkflowStage("closed");
  const cancelledResult = deriveWorkOrderWorkflowStage("cancelled");

  assert.equal(closedResult.currentStageId, "closed");
  assert.equal(cancelledResult.currentStageId, "closed");
  assert.equal(closedResult.stages[7]?.state, "current");
  assert.equal(cancelledResult.stages[7]?.state, "current");
});

test("workflow stage falls back for unknown statuses", () => {
  const result = deriveWorkOrderWorkflowStage("mystery" as WorkOrderStatus);

  assert.equal(result.currentStageId, null);
  assert.equal(result.isFallback, true);
});

test("workflow actions returns empty state when updates are unavailable", () => {
  const result = deriveWorkflowActions({
    allowedTransitions: ["assigned", "cancelled"],
    statusActionEnabled: false,
  });

  assert.deepEqual(result.all, []);
});

test("workflow actions separate destructive and exception actions", () => {
  const result = deriveWorkflowActions({
    allowedTransitions: ["in_progress", "on_hold", "escalated", "cancelled", "closed"],
    statusActionEnabled: true,
  });

  assert.deepEqual(
    result.primary.map((action) => action.status),
    ["in_progress"],
  );
  assert.deepEqual(
    result.exception.map((action) => action.status),
    ["on_hold", "escalated"],
  );
  assert.deepEqual(
    result.destructive.map((action) => action.status),
    ["cancelled"],
  );
  assert.deepEqual(
    result.terminal.map((action) => action.status),
    ["closed"],
  );
});

test("workflow history snapshot returns the five newest items", () => {
  const result = buildWorkflowHistorySnapshot({
    assignments: [
      {
        id: "assignment-1",
        assigneeDisplayName: "North Mechanical",
        assignedByDisplayName: "Jordan Ops",
        status: "accepted",
        assignedAt: "2026-05-07T09:00:00.000Z",
        acceptedAt: "2026-05-07T12:00:00.000Z",
        declinedAt: null,
        completedAt: null,
      },
    ],
    limit: 5,
    status: "in_progress",
    timeline: [
      {
        id: "timeline-1",
        occurredAt: "2026-05-08T11:00:00.000Z",
        type: "work_order_status_changed",
        summary: "Moved to In Progress",
        actor: {
          actorType: "user",
          displayName: "Taylor Manager",
        },
        entity: {
          entityType: "work_order",
          label: null,
        },
      },
      {
        id: "timeline-2",
        occurredAt: "2026-05-08T08:00:00.000Z",
        type: "assignment_updated",
        summary: "Assignment accepted",
        actor: {
          actorType: "user",
          displayName: "North Mechanical",
        },
        entity: {
          entityType: "assignment",
          label: "Dispatch",
        },
      },
    ],
    updatedAt: "2026-05-08T10:00:00.000Z",
  });

  assert.equal(result.length, 4);
  assert.equal(result[0]?.title, "Moved to In Progress");
  assert.equal(result[1]?.title, "Status snapshot");
});
