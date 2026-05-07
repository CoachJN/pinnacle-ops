import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeHarness } from "./support/runtime-harness.ts";
import type { DomainEvent } from "../server/events/types.ts";
import { USER_ROLES } from "../types/permissions.ts";

test("event-to-job bridge preserves stable enqueue contracts and prevents duplicate jobs", async () => {
  const harness = createRuntimeHarness();
  const event = makeWorkOrderCreatedEvent();
  harness.events.push(event);

  const first = await harness.runtime.subscribers.processEvent({
    event,
    now: "2026-05-06T17:00:00.000Z",
  });
  assert.equal(first.ok, true);
  assert.equal(harness.jobs.length, 1);
  assert.equal(harness.slaTimers.length, 1);
  assert.deepEqual(harness.jobs[0], {
    ...harness.jobs[0],
    organizationId: "org-1",
    tenantId: "org-1",
    type: "sla.timer.evaluate",
    payload: {
      timerId: harness.slaTimers[0]?.id,
      payloadVersion: "v1",
    },
    payloadVersion: "v1",
    idempotencyKey: `sla.timer.evaluate:${harness.slaTimers[0]?.id}:due:${harness.slaTimers[0]?.dueAt}`,
    correlationId: "event:event-work-order-bridge-1",
    causationId: "event-work-order-bridge-1",
    sourceEventId: "event-work-order-bridge-1",
  });

  const replay = await harness.runtime.subscribers.processEvent({
    event,
    now: "2026-05-06T17:01:00.000Z",
    force: true,
  });
  assert.equal(replay.ok, true);
  assert.equal(replay.value[0]?.processing.status, "succeeded");
  assert.equal(harness.jobs.length, 1);
  assert.equal(
    harness.eventProcessings[0]?.jobs[0]?.idempotencyKey,
    "sla.timer.evaluate:wo-3:work_order_created:event-work-order-bridge-1",
  );
});

function makeWorkOrderCreatedEvent(): DomainEvent<"work_order_created"> {
  return {
    id: "event-work-order-bridge-1",
    organizationId: "org-1",
    tenantId: "org-1",
    workOrderId: "wo-3",
    type: "work_order_created",
    actor: {
      actorId: "manager-2",
      actorType: "user",
      actorRole: USER_ROLES.Manager,
      displayName: "Manager Two",
    },
    visibility: "internal",
    occurredAt: "2026-05-06T16:59:00.000Z",
    lifecycleStatus: "new",
    entity: {
      entityType: "work_order",
      entityId: "wo-3",
      label: "WO-3",
    },
    summary: "Work order created.",
    metadata: {
      requestId: "req-3",
      reason: null,
      correlationId: null,
      details: {},
    },
    payload: {
      lifecycleStatus: "new",
      priority: "high",
      title: "Roof leak",
    },
  };
}
