import assert from "node:assert/strict";
import test from "node:test";

import type { EventSubscriberDefinition } from "../modules/runtime/index.ts";
import { createRuntimeHarness, createRuntimeHarnessWithSubscribers } from "./support/runtime-harness.ts";
import type { DomainEvent } from "../server/events/types.ts";
import { USER_ROLES } from "../types/permissions.ts";

test("event subscriber processing is duplicate-safe and replay-safe for canonical events", async () => {
  const harness = createRuntimeHarness();
  const event = makeWorkOrderCreatedEvent();
  harness.events.push(event);

  const first = await harness.runtime.subscribers.processEvent({
    event,
    now: "2026-05-06T15:00:00.000Z",
  });
  assert.equal(first.ok, true);
  assert.equal(first.value.length, 1);
  assert.equal(first.value[0]?.processing.status, "succeeded");
  assert.equal(first.value[0]?.processing.subscriberKey, "lifecycle-sla-timer");
  assert.equal(first.value[0]?.processing.correlationId, "corr-work-order-1");
  assert.equal(first.value[0]?.processing.causationId, event.id);
  assert.equal(first.value[0]?.processing.sourceEventId, event.id);

  const duplicate = await harness.runtime.subscribers.processEventById({
    organizationId: "org-1",
    eventId: event.id,
    now: "2026-05-06T15:00:30.000Z",
  });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.value[0]?.duplicate, true);
  assert.equal(harness.jobs.length, 1);
  assert.equal(harness.slaTimers.length, 1);
  assert.equal(harness.eventProcessings.length, 1);
  assert.equal(
    harness.jobs[0]?.idempotencyKey,
    `sla.timer.evaluate:${harness.slaTimers[0]?.id}:due:${harness.slaTimers[0]?.dueAt}`,
  );
});

test("failed subscriber processing is durable, diagnosable, and retryable", async () => {
  let attempts = 0;
  const harness = createRuntimeHarnessWithSubscribers([
    {
      key: "failing-subscriber",
      name: "Failing Subscriber",
      description: "Throws once before succeeding to prove retry safety.",
      eventTypes: ["work_order_created"],
      jobType: "test.followup",
      buildJobs(context) {
        attempts += 1;
        if (attempts === 1) {
          throw new Error("temporary subscriber failure");
        }

        return [
          {
            type: "test.followup",
            payloadVersion: "v1",
            idempotencyKey: `test.followup:${context.sourceEventId}`,
            payload: {
              sourceEventId: context.sourceEventId,
            },
          },
        ];
      },
    } satisfies EventSubscriberDefinition,
  ]);

  const event = makeWorkOrderCreatedEvent();
  harness.events.push(event);

  const failed = await harness.runtime.subscribers.processEvent({
    event,
    now: "2026-05-06T16:00:00.000Z",
  });
  assert.equal(failed.ok, true);
  assert.equal(failed.value[0]?.processing.status, "failed");
  assert.equal(failed.value[0]?.processing.attemptCount, 1);
  assert.equal(harness.jobs.length, 0);

  const diagnostics = await harness.runtime.subscriberDiagnostics.getSummary({
    organizationId: "org-1",
    limit: 10,
  });
  assert.equal(diagnostics.ok, true);
  assert.equal(diagnostics.value.failedCount, 1);
  assert.equal(diagnostics.value.recentFailures[0]?.subscriberKey, "failing-subscriber");

  const retried = await harness.runtime.subscribers.processEventById({
    organizationId: "org-1",
    eventId: event.id,
    now: "2026-05-06T16:01:00.000Z",
  });
  assert.equal(retried.ok, true);
  assert.equal(retried.value[0]?.processing.status, "succeeded");
  assert.equal(retried.value[0]?.processing.attemptCount, 2);
  assert.equal(harness.jobs.length, 1);
  assert.equal(harness.eventProcessings.length, 1);
});

function makeWorkOrderCreatedEvent(): DomainEvent<"work_order_created"> {
  return {
    id: "event-work-order-1",
    organizationId: "org-1",
    tenantId: "org-1",
    workOrderId: "wo-2",
    type: "work_order_created",
    actor: {
      actorId: "coordinator-1",
      actorType: "user",
      actorRole: USER_ROLES.Coordinator,
      displayName: "Coordinator One",
    },
    visibility: "internal",
    occurredAt: "2026-05-06T15:59:00.000Z",
    lifecycleStatus: "new",
    entity: {
      entityType: "work_order",
      entityId: "wo-2",
      label: "WO-2",
    },
    summary: "Work order created.",
    metadata: {
      requestId: "req-2",
      reason: null,
      correlationId: "corr-work-order-1",
      details: {},
    },
    payload: {
      lifecycleStatus: "new",
      priority: "high",
      title: "Roof leak",
    },
  };
}
