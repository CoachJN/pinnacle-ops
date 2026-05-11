import assert from "node:assert/strict";
import test from "node:test";

import type { DomainEvent } from "../server/events/types.ts";
import { USER_ROLES } from "../types/permissions.ts";
import { createEventReplayService } from "../modules/runtime/server/event-replay-service.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("event replay service safely reprocesses persisted canonical events by id and batch", async () => {
  const harness = createRuntimeHarness();
  const event = makeWorkOrderCreatedEvent("event-runtime-replay-1");
  harness.events.push(event);

  const replay = createEventReplayService(
    {
      domainEvents: {
        async listByOrganizationId() {
          return { items: [event], count: 1 };
        },
      } as never,
    },
    harness.runtime.subscribers,
  );

  const byId = await replay.replay({
    organizationId: "org-1",
    eventId: event.id,
    now: "2026-05-06T22:00:00.000Z",
  });
  assert.equal(byId.ok, true);
  assert.equal(byId.value[0]?.processing.status, "succeeded");
  assert.equal(harness.jobs.length, 1);

  const batchReplay = await replay.replay({
    organizationId: "org-1",
    batchSize: 10,
    force: true,
    now: "2026-05-06T22:01:00.000Z",
  });
  assert.equal(batchReplay.ok, true);
  assert.equal(batchReplay.value[0]?.processing.status, "succeeded");
  assert.equal(harness.jobs.length, 1);
  assert.equal(harness.eventProcessings.length, 1);
});

function makeWorkOrderCreatedEvent(eventId: string): DomainEvent<"work_order_created"> {
  return {
    id: eventId,
    organizationId: "org-1",
    tenantId: "org-1",
    workOrderId: "wo-runtime-replay-1",
    type: "work_order_created",
    actor: {
      actorId: "manager-1",
      actorType: "user",
      actorRole: USER_ROLES.Manager,
      displayName: "Manager One",
    },
    visibility: "internal",
    occurredAt: "2026-05-06T21:59:00.000Z",
    lifecycleStatus: "new",
    entity: {
      entityType: "work_order",
      entityId: "wo-runtime-replay-1",
      label: "WO-RUNTIME-REPLAY-1",
    },
    summary: "Work order created.",
    metadata: {
      requestId: "req-runtime-replay-1",
      reason: null,
      correlationId: null,
      details: {},
    },
    payload: {
      lifecycleStatus: "new",
      priority: "high",
      title: "Replay-safe freezer repair",
    },
  };
}
