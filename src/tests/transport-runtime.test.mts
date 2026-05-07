import assert from "node:assert/strict";
import test from "node:test";

import { createTransportExecuteHandler } from "../modules/transport/index.ts";
import { createWorkerHandlerRegistry } from "../modules/runtime/server/worker-handler-registry.ts";
import { createWorkerRunnerService } from "../modules/runtime/server/worker-runner-service.ts";
import type { DomainServices } from "../server/services/index.ts";
import type { DeliveryPlan } from "../modules/delivery/index.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";
import { makeWorkOrder } from "./support/escalation-fixtures.ts";

test("transport runtime persists a durable internal execution attempt without mutating work orders", async () => {
  const harness = createRuntimeHarness();
  const originalWorkOrder = makeWorkOrder("wo-transport-runtime-1");
  originalWorkOrder.coordinatorUserId = "user-coordinator";
  originalWorkOrder.managerUserId = "user-manager";
  harness.workOrders.push({ ...originalWorkOrder });

  const plan = makeDeliveryPlan("delivery-plan-runtime-1", originalWorkOrder.id);
  harness.deliveryPlans.push(plan);

  const queued = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "system", role: "system" },
    now: "2026-05-06T12:01:00.000Z",
    type: "transport.execute",
    payloadVersion: "v1",
    payload: {
      payloadVersion: "v1",
      deliveryPlanId: plan.id,
      deliveryType: plan.deliveryType,
      attemptNumber: 0,
      reason: "delivery_scheduled",
      triggerEventType: "delivery_scheduled",
    },
    idempotencyKey: "transport.execute:delivery-plan-runtime-1:attempt:0",
    correlationId: plan.correlationId,
    causationId: plan.id,
    sourceEventId: plan.sourceEventId,
    maxAttempts: 1,
  });
  assert.equal(queued.ok, true);

  const runner = createWorkerRunnerService(
    harness.runtime,
    createWorkerHandlerRegistry<DomainServices>([createTransportExecuteHandler()]),
  );

  const processed = await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-transport-runtime",
    now: "2026-05-06T12:02:00.000Z",
    jobTypes: ["transport.execute"],
  });
  assert.equal(processed.ok, true);
  assert.equal(processed.value.completedCount, 1);

  assert.equal(harness.deliveryAttempts.length, 1);
  assert.equal(harness.deliveryAttempts[0]?.status, "succeeded");
  assert.equal(harness.deliveryAttempts[0]?.providerMessageId, "internal-message:delivery-plan-runtime-1:0");
  assert.equal(harness.deliveryPlans[0]?.status, "completed");
  assert.deepEqual(harness.workOrders[0], originalWorkOrder);
  assert.deepEqual(
    harness.events
      .filter((event) => event.type.startsWith("transport_attempt_") || event.type === "delivery_completed")
      .map((event) => event.type),
    [
      "transport_attempt_queued",
      "transport_attempt_executing",
      "transport_attempt_succeeded",
      "delivery_completed",
    ],
  );
});

function makeDeliveryPlan(id: string, workOrderId: string): DeliveryPlan {
  return {
    id,
    organizationId: "org-1",
    tenantId: "org-1",
    deliveryType: "escalation.first_response_breach_notification",
    sourceEscalationId: "esc-transport-runtime-1",
    sourceEscalationStageNumber: 1,
    sourceEventId: "event-delivery-runtime-1",
    correlationId: "corr-transport-runtime-1",
    causationId: "cause-transport-runtime-1",
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
    nextAttemptAt: "2026-05-06T12:01:00.000Z",
    suppressionReason: null,
    cancellationReason: null,
    activeRuntimeJobId: null,
    noopCount: 0,
    createdAt: "2026-05-06T12:00:00.000Z",
    updatedAt: "2026-05-06T12:00:00.000Z",
  };
}
