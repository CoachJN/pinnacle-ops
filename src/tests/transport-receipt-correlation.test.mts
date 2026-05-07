import assert from "node:assert/strict";
import test from "node:test";

import { createTransportExecuteHandler } from "../modules/transport/index.ts";
import { createWorkerHandlerRegistry } from "../modules/runtime/server/worker-handler-registry.ts";
import { createWorkerRunnerService } from "../modules/runtime/server/worker-runner-service.ts";
import type { DomainServices } from "../server/services/index.ts";
import type { DeliveryPlan } from "../modules/delivery/index.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("transport diagnostics expose receipt correlation for canonical delivery attempts", async () => {
  const harness = createRuntimeHarness();
  harness.deliveryPlans.push(makeDeliveryPlan("delivery-plan-receipt-1", "wo-transport-receipt-1"));

  const queued = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "system", role: "system" },
    now: "2026-05-06T15:00:00.000Z",
    type: "transport.execute",
    payloadVersion: "v1",
    payload: {
      payloadVersion: "v1",
      deliveryPlanId: "delivery-plan-receipt-1",
      deliveryType: "escalation.first_response_breach_notification",
      attemptNumber: 0,
      reason: "delivery_scheduled",
      triggerEventType: "delivery_scheduled",
    },
    idempotencyKey: "transport.execute:delivery-plan-receipt-1:attempt:0",
    correlationId: "corr-transport-receipt-1",
    causationId: "delivery-plan-receipt-1",
    sourceEventId: "event-transport-receipt-1",
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
    workerId: "worker-transport-receipt",
    now: "2026-05-06T15:01:00.000Z",
    jobTypes: ["transport.execute"],
  });
  assert.equal(processed.ok, true);

  const attempt = harness.deliveryAttempts[0];
  assert.ok(attempt);
  const diagnostics = await harness.transport.diagnostics.getSummary({
    organizationId: "org-1",
    limit: 10,
  });
  assert.equal(diagnostics.ok, true);
  assert.equal(diagnostics.value.receiptCorrelationSummaries.length, 1);
  assert.equal(diagnostics.value.receiptCorrelationSummaries[0]?.deliveryAttemptId, attempt.id);
  assert.equal(diagnostics.value.receiptCorrelationSummaries[0]?.providerMessageId, attempt.providerMessageId);
  assert.equal(diagnostics.value.receiptCorrelationSummaries[0]?.providerCorrelationId, attempt.providerCorrelationId);
  assert.equal(diagnostics.value.receiptCorrelationSummaries[0]?.providerReceiptId, attempt.providerReceiptId);
});

function makeDeliveryPlan(id: string, workOrderId: string): DeliveryPlan {
  return {
    id,
    organizationId: "org-1",
    tenantId: "org-1",
    deliveryType: "escalation.first_response_breach_notification",
    sourceEscalationId: "esc-transport-receipt-1",
    sourceEscalationStageNumber: 1,
    sourceEventId: "event-transport-receipt-1",
    correlationId: "corr-transport-receipt-1",
    causationId: "cause-transport-receipt-1",
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
    nextAttemptAt: "2026-05-06T15:00:00.000Z",
    suppressionReason: null,
    cancellationReason: null,
    activeRuntimeJobId: null,
    noopCount: 0,
    createdAt: "2026-05-06T14:59:00.000Z",
    updatedAt: "2026-05-06T14:59:00.000Z",
  };
}
