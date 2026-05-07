import assert from "node:assert/strict";
import test from "node:test";

import type { DeliveryPlan } from "@/modules/delivery/index.ts";
import { createTransportExecuteHandler } from "@/modules/transport/index.ts";
import { createWorkerHandlerRegistry } from "@/modules/runtime/server/worker-handler-registry.ts";
import { createWorkerRunnerService } from "@/modules/runtime/server/worker-runner-service.ts";
import type { DomainServices } from "@/server/services/index.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("duplicate provider webhooks noop safely and do not duplicate canonical receipts", async () => {
  const harness = createRuntimeHarness();
  harness.deliveryPlans.push(makeEmailDeliveryPlan("delivery-plan-provider-2", "wo-provider-2"));

  const queued = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "system", role: "system" },
    now: "2026-05-06T17:00:00.000Z",
    type: "transport.execute",
    payloadVersion: "v1",
    payload: {
      payloadVersion: "v1",
      deliveryPlanId: "delivery-plan-provider-2",
      deliveryType: "escalation.first_response_breach_notification",
      attemptNumber: 0,
      reason: "delivery_scheduled",
      triggerEventType: "delivery_scheduled",
    },
    idempotencyKey: "transport.execute:delivery-plan-provider-2:attempt:0",
    correlationId: "corr-provider-runtime-2",
    causationId: "delivery-plan-provider-2",
    sourceEventId: "event-provider-runtime-2",
    maxAttempts: 1,
  });
  assert.equal(queued.ok, true);

  const runner = createWorkerRunnerService(
    harness.runtime,
    createWorkerHandlerRegistry<DomainServices>([createTransportExecuteHandler()]),
  );
  await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-provider-runtime-2",
    now: "2026-05-06T17:01:00.000Z",
    jobTypes: ["transport.execute"],
  });

  const providerMessageId = harness.deliveryAttempts[0]?.providerMessageId;
  assert.ok(providerMessageId);

  const payload = {
    value: [
      {
        subscriptionId: "sub-1",
        changeType: "delivered",
        resourceData: {
          id: providerMessageId,
          providerReceiptId: `receipt:${providerMessageId}`,
          deliveryAttemptId: harness.deliveryAttempts[0]?.id,
          deliveryPlanId: harness.deliveryAttempts[0]?.deliveryPlanId,
        },
      },
    ],
  };

  const first = await harness.providerRuntime.webhooks.handleMicrosoftGraphWebhook({
    organizationId: "org-1",
    payload,
    now: "2026-05-06T17:05:00.000Z",
  });
  const second = await harness.providerRuntime.webhooks.handleMicrosoftGraphWebhook({
    organizationId: "org-1",
    payload,
    now: "2026-05-06T17:06:00.000Z",
  });

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(harness.providerWebhookEvents.length, 1);
  assert.equal(harness.providerReceipts.filter((item) => item.normalizedStatus === "delivered").length, 1);
  assert.equal(second.value.duplicates >= 1, true);
});

function makeEmailDeliveryPlan(id: string, workOrderId: string): DeliveryPlan {
  return {
    id,
    organizationId: "org-1",
    tenantId: "org-1",
    deliveryType: "escalation.first_response_breach_notification",
    sourceEscalationId: "esc-provider-runtime-2",
    sourceEscalationStageNumber: 1,
    sourceEventId: "event-provider-runtime-2",
    correlationId: "corr-provider-runtime-2",
    causationId: "cause-provider-runtime-2",
    idempotencyKey: `delivery.plan:${id}`,
    targetEntityType: "work_order",
    targetEntityId: workOrderId,
    recipientType: "assigned_manager",
    recipientId: "user-manager",
    recipientAddress: "manager@example.com",
    channel: "email",
    templateId: "delivery.escalation.first_response_breach",
    templateVersion: "v1",
    priority: "high",
    status: "scheduled",
    retryCount: 0,
    nextAttemptAt: "2026-05-06T17:00:00.000Z",
    suppressionReason: null,
    cancellationReason: null,
    activeRuntimeJobId: null,
    noopCount: 0,
    createdAt: "2026-05-06T16:59:00.000Z",
    updatedAt: "2026-05-06T16:59:00.000Z",
  };
}
