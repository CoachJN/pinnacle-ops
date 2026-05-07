import assert from "node:assert/strict";
import test from "node:test";

import { createEscalationProgressHandler } from "../modules/escalation/index.ts";
import { createWorkerHandlerRegistry } from "../modules/runtime/server/worker-handler-registry.ts";
import { createWorkerRunnerService } from "../modules/runtime/server/worker-runner-service.ts";
import type { DomainEvent } from "../server/events/types.ts";
import type { DomainServices } from "../server/services/index.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";
import { makeWorkOrder } from "./support/escalation-fixtures.ts";

test("duplicate breach replays and duplicate stage jobs do not create duplicate active escalations", async () => {
  const harness = createRuntimeHarness();
  harness.workOrders.push(makeWorkOrder("wo-1"));
  harness.slaTimers.push({
    id: "timer-1",
    organizationId: "org-1",
    tenantId: "org-1",
    type: "work_order.first_response_due",
    targetEntityType: "work_order",
    targetEntityId: "wo-1",
    status: "breached",
    dueAt: "2026-05-06T12:30:00.000Z",
    policyVersion: "2026-05-06.v1",
    payloadVersion: "v1",
    condition: {
      kind: "work_order_first_response",
      workOrderId: "wo-1",
      activationEventId: "event-created-1",
      activationEventType: "work_order_created",
      activationOccurredAt: "2026-05-06T09:00:00.000Z",
      initialLifecycleStatus: "new",
    },
    sourceEventId: "event-created-1",
    correlationId: "corr-escalation-dedupe",
    causationId: "event-created-1",
    idempotencyKey: "work_order.first_response_due:work_order:wo-1",
    runtimeJobId: null,
    evaluatedAt: "2026-05-06T12:30:00.000Z",
    satisfiedAt: null,
    breachedAt: "2026-05-06T12:30:00.000Z",
    cancelledAt: null,
    failureReason: null,
    createdAt: "2026-05-06T09:00:00.000Z",
    updatedAt: "2026-05-06T12:30:00.000Z",
  });
  harness.slaTimers.push({
    ...harness.slaTimers[0]!,
    id: "timer-2",
    sourceEventId: "event-created-2",
    causationId: "event-created-2",
    idempotencyKey: "work_order.first_response_due:work_order:wo-1:2",
  });
  const breachEvent = makeBreachEvent("event-escalation-breach-1", "timer-1", "wo-1");
  harness.events.push(breachEvent);

  await harness.runtime.subscribers.processEvent({
    event: breachEvent,
    now: "2026-05-06T12:30:00.000Z",
  });
  await harness.runtime.subscribers.processEvent({
    event: breachEvent,
    now: "2026-05-06T12:30:01.000Z",
    force: true,
  });

  const runner = createWorkerRunnerService(
    harness.runtime,
    createWorkerHandlerRegistry<DomainServices>([createEscalationProgressHandler()]),
  );
  await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-escalation-dedupe-1",
    now: "2026-05-06T12:30:10.000Z",
    jobTypes: ["escalation.progress"],
  });

  const secondBreach = makeBreachEvent("event-escalation-breach-2", "timer-2", "wo-1");
  harness.events.push(secondBreach);
  await harness.runtime.subscribers.processEvent({
    event: secondBreach,
    now: "2026-05-06T12:31:00.000Z",
  });
  await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-escalation-dedupe-2",
    now: "2026-05-06T12:31:10.000Z",
    jobTypes: ["escalation.progress"],
  });

  assert.equal(
    harness.escalationOrchestrations.filter((item) => item.status === "active").length,
    1,
  );
  assert.equal(
    harness.escalationOrchestrations.filter((item) => item.status === "suppressed").length,
    1,
  );
  assert.equal(harness.events.filter((item) => item.type === "escalation_suppressed").length, 1);
});

function makeBreachEvent(
  eventId: string,
  timerId: string,
  workOrderId: string,
): DomainEvent<"sla_timer_breached"> {
  return {
    id: eventId,
    organizationId: "org-1",
    tenantId: "org-1",
    workOrderId,
    type: "sla_timer_breached",
    actor: {
      actorId: null,
      actorType: "system",
      actorRole: "system",
      displayName: null,
    },
    visibility: "internal",
    occurredAt: "2026-05-06T12:30:00.000Z",
    lifecycleStatus: "new",
    entity: {
      entityType: "sla_timer",
      entityId: timerId,
      label: "work_order.first_response_due",
    },
    summary: "SLA timer breached.",
    metadata: {
      requestId: `req-${eventId}`,
      reason: null,
      correlationId: "corr-escalation-dedupe",
      details: {},
    },
    payload: {
      timerId,
      timerType: "work_order.first_response_due",
      targetEntityType: "work_order",
      targetEntityId: workOrderId,
      dueAt: "2026-05-06T12:30:00.000Z",
      policyVersion: "2026-05-06.v1",
    },
  };
}
