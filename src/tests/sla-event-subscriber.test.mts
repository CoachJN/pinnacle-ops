import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeHarness } from "./support/runtime-harness.ts";
import type { DomainEvent } from "../server/events/types.ts";
import { USER_ROLES } from "../types/permissions.ts";

test("sla event subscriber creates one active timer and replacement evaluation jobs without duplicating timers", async () => {
  const harness = createRuntimeHarness();
  const created = makeWorkOrderCreatedEvent("event-sla-created-1", "wo-sla-subscriber-1");
  harness.events.push(created);

  const first = await harness.runtime.subscribers.processEvent({
    event: created,
    now: "2026-05-06T09:00:00.000Z",
  });
  assert.equal(first.ok, true);
  assert.equal(harness.slaTimers.length, 1);
  assert.equal(harness.jobs.length, 1);
  assert.equal(harness.slaTimers[0]?.runtimeJobId, harness.jobs[0]?.id);

  const response = makeInternalMessageEvent("event-sla-response-1", "wo-sla-subscriber-1");
  harness.events.push(response);
  const second = await harness.runtime.subscribers.processEvent({
    event: response,
    now: "2026-05-06T09:30:00.000Z",
  });
  assert.equal(second.ok, true);
  assert.equal(harness.slaTimers.length, 1);
  assert.equal(harness.jobs.length, 2);
  assert.equal(harness.jobs[1]?.runAfter, "2026-05-06T09:30:00.000Z");
  assert.equal(harness.slaTimers[0]?.runtimeJobId, harness.jobs[1]?.id);

  const replay = await harness.runtime.subscribers.processEvent({
    event: response,
    now: "2026-05-06T09:31:00.000Z",
    force: true,
  });
  assert.equal(replay.ok, true);
  assert.equal(harness.slaTimers.length, 1);
  assert.equal(harness.jobs.length, 2);
});

function makeWorkOrderCreatedEvent(
  eventId: string,
  workOrderId: string,
): DomainEvent<"work_order_created"> {
  return {
    id: eventId,
    organizationId: "org-1",
    tenantId: "org-1",
    workOrderId,
    type: "work_order_created",
    actor: {
      actorId: "coordinator-1",
      actorType: "user",
      actorRole: USER_ROLES.Coordinator,
      displayName: "Coordinator One",
    },
    visibility: "internal",
    occurredAt: "2026-05-06T09:00:00.000Z",
    lifecycleStatus: "new",
    entity: {
      entityType: "work_order",
      entityId: workOrderId,
      label: "WO-SLA-SUBSCRIBER-1",
    },
    summary: "Work order created.",
    metadata: {
      requestId: "req-sla-subscriber-1",
      reason: null,
      correlationId: "corr-sla-subscriber-1",
      details: {},
    },
    payload: {
      lifecycleStatus: "new",
      priority: "high",
      title: "Roof leak",
    },
  };
}

function makeInternalMessageEvent(
  eventId: string,
  workOrderId: string,
): DomainEvent<"communication_message_created"> {
  return {
    id: eventId,
    organizationId: "org-1",
    tenantId: "org-1",
    workOrderId,
    type: "communication_message_created",
    actor: {
      actorId: "manager-1",
      actorType: "user",
      actorRole: USER_ROLES.Manager,
      displayName: "Manager One",
    },
    visibility: "internal",
    occurredAt: "2026-05-06T09:29:00.000Z",
    lifecycleStatus: "new",
    entity: {
      entityType: "communication_message",
      entityId: "message-1",
      label: "Internal note",
    },
    summary: "Created internal note.",
    metadata: {
      requestId: "req-sla-subscriber-2",
      reason: null,
      correlationId: "corr-sla-subscriber-1",
      details: {},
    },
    payload: {
      threadId: "thread-1",
      messageId: "message-1",
      channel: "internal_note",
      direction: "internal",
    },
  };
}
