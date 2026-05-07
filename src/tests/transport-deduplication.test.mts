import assert from "node:assert/strict";
import test from "node:test";

import { createTransportExecuteHandler } from "../modules/transport/index.ts";
import { createWorkerHandlerRegistry } from "../modules/runtime/server/worker-handler-registry.ts";
import { createWorkerRunnerService } from "../modules/runtime/server/worker-runner-service.ts";
import type { DomainEvent } from "../server/events/types.ts";
import type { DomainServices } from "../server/services/index.ts";
import type { DeliveryPlan } from "../modules/delivery/index.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("delivery event replay and duplicate transport execution noop safely", async () => {
  const harness = createRuntimeHarness();
  harness.deliveryPlans.push(makeDeliveryPlan("delivery-plan-dedup-1", "wo-transport-dedup-1"));

  const plannedEvent = makeDeliveryEvent("delivery_planned", "event-transport-dedup-planned", "delivery-plan-dedup-1");
  const scheduledEvent = makeDeliveryEvent("delivery_scheduled", "event-transport-dedup-scheduled", "delivery-plan-dedup-1");
  harness.events.push(plannedEvent, scheduledEvent);

  const planned = await harness.runtime.subscribers.processEvent({
    event: plannedEvent,
    now: "2026-05-06T14:00:00.000Z",
  });
  const scheduled = await harness.runtime.subscribers.processEvent({
    event: scheduledEvent,
    now: "2026-05-06T14:00:05.000Z",
  });
  assert.equal(planned.ok, true);
  assert.equal(scheduled.ok, true);
  assert.equal(harness.jobs.filter((job) => job.type === "transport.execute").length, 1);

  const replay = await harness.runtime.subscribers.processEvent({
    event: scheduledEvent,
    now: "2026-05-06T14:00:06.000Z",
    force: true,
  });
  assert.equal(replay.ok, true);
  assert.equal(harness.jobs.filter((job) => job.type === "transport.execute").length, 1);

  const runner = createWorkerRunnerService(
    harness.runtime,
    createWorkerHandlerRegistry<DomainServices>([createTransportExecuteHandler()]),
  );
  const run = await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-transport-dedup",
    now: "2026-05-06T14:01:00.000Z",
    jobTypes: ["transport.execute"],
  });
  assert.equal(run.ok, true);
  assert.equal(harness.deliveryAttempts.length, 1);

  const duplicate = await harness.transport.runtime.processJob({
    organizationId: "org-1",
    payload: {
      payloadVersion: "v1",
      deliveryPlanId: "delivery-plan-dedup-1",
      deliveryType: "escalation.first_response_breach_notification",
      attemptNumber: 0,
      reason: "manual_replay",
      triggerEventType: "delivery_scheduled",
    },
    runtimeJobId: "runtime-transport-dedup-duplicate",
    correlationId: "corr-transport-dedup-1",
    causationId: "manual-replay",
    sourceEventId: "event-transport-dedup-scheduled",
    now: "2026-05-06T14:02:00.000Z",
    enqueueRuntimeJob: async () => {
      throw new Error("No retry enqueue expected for duplicate execution.");
    },
  });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.value.outcome, "noop_duplicate");
  assert.equal(harness.deliveryAttempts.length, 1);
});

function makeDeliveryPlan(id: string, workOrderId: string): DeliveryPlan {
  return {
    id,
    organizationId: "org-1",
    tenantId: "org-1",
    deliveryType: "escalation.first_response_breach_notification",
    sourceEscalationId: "esc-transport-dedup-1",
    sourceEscalationStageNumber: 1,
    sourceEventId: "event-transport-dedup-source",
    correlationId: "corr-transport-dedup-1",
    causationId: "cause-transport-dedup-1",
    idempotencyKey: `delivery.plan:${id}`,
    targetEntityType: "work_order",
    targetEntityId: workOrderId,
    recipientType: "assigned_manager",
    recipientId: "user-manager",
    recipientAddress: "manager@example.com",
    channel: "internal",
    templateId: "delivery.escalation.first_response_breach",
    templateVersion: "v1",
    priority: "high",
    status: "scheduled",
    retryCount: 0,
    nextAttemptAt: "2026-05-06T14:00:00.000Z",
    suppressionReason: null,
    cancellationReason: null,
    activeRuntimeJobId: null,
    noopCount: 0,
    createdAt: "2026-05-06T13:59:00.000Z",
    updatedAt: "2026-05-06T13:59:00.000Z",
  };
}

function makeDeliveryEvent(
  type: "delivery_planned" | "delivery_scheduled",
  id: string,
  deliveryPlanId: string,
): DomainEvent<"delivery_planned"> | DomainEvent<"delivery_scheduled"> {
  return {
    id,
    organizationId: "org-1",
    tenantId: "org-1",
    workOrderId: "wo-transport-dedup-1",
    type,
    actor: {
      actorId: null,
      actorType: "system",
      actorRole: "system",
      displayName: "System",
    },
    visibility: "internal",
    occurredAt: "2026-05-06T14:00:00.000Z",
    lifecycleStatus: null,
    entity: {
      entityType: "delivery_plan",
      entityId: deliveryPlanId,
      label: "escalation.first_response_breach_notification",
    },
    summary: `${type} event`,
    metadata: {
      requestId: id,
      reason: type,
      correlationId: "corr-transport-dedup-1",
      details: {},
    },
    payload: {
      deliveryPlanId,
      deliveryType: "escalation.first_response_breach_notification",
      sourceEscalationId: "esc-transport-dedup-1",
      sourceEscalationStageNumber: 1,
      targetEntityType: "work_order",
      targetEntityId: "wo-transport-dedup-1",
      recipientType: "assigned_manager",
      recipientId: "user-manager",
      channel: "internal",
      status: "scheduled",
      retryCount: 0,
      ...(type === "delivery_scheduled" ? { nextAttemptAt: "2026-05-06T14:00:00.000Z" } : {}),
    } as never,
  };
}
