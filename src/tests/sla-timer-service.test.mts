import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeHarness } from "./support/runtime-harness.ts";
import type { DomainEvent } from "../server/events/types.ts";
import { USER_ROLES } from "../types/permissions.ts";

test("sla timer service schedules first-response timers idempotently", async () => {
  const harness = createRuntimeHarness();
  const event = makeWorkOrderCreatedEvent("event-sla-service-1", "wo-sla-service-1");

  const first = await harness.sla.timers.createFirstResponseTimer({
    organizationId: "org-1",
    sourceEvent: event,
    dueAt: "2026-05-06T14:00:00.000Z",
    policyVersion: "work_order.first_response_due.v1",
    payloadVersion: "v1",
    correlationId: "corr-sla-service-1",
    causationId: event.id,
    now: "2026-05-06T10:00:00.000Z",
  });
  assert.equal(first.ok, true);
  assert.equal(first.value.created, true);
  assert.equal(harness.slaTimers.length, 1);

  const duplicate = await harness.sla.timers.createFirstResponseTimer({
    organizationId: "org-1",
    sourceEvent: event,
    dueAt: "2026-05-06T14:00:00.000Z",
    policyVersion: "work_order.first_response_due.v1",
    payloadVersion: "v1",
    correlationId: "corr-sla-service-1",
    causationId: event.id,
    now: "2026-05-06T10:01:00.000Z",
  });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.value.created, false);
  assert.equal(duplicate.value.timer.id, first.value.timer.id);
  assert.equal(harness.slaTimers.length, 1);
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
      actorId: "manager-1",
      actorType: "user",
      actorRole: USER_ROLES.Manager,
      displayName: "Manager One",
    },
    visibility: "internal",
    occurredAt: "2026-05-06T10:00:00.000Z",
    lifecycleStatus: "new",
    entity: {
      entityType: "work_order",
      entityId: workOrderId,
      label: workOrderId.toUpperCase(),
    },
    summary: "Work order created.",
    metadata: {
      requestId: "req-sla-service-1",
      reason: null,
      correlationId: "corr-sla-service-1",
      details: {},
    },
    payload: {
      lifecycleStatus: "new",
      priority: "high",
      title: "Roof leak",
    },
  };
}
