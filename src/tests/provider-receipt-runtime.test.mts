import assert from "node:assert/strict";
import test from "node:test";

import { createProviderReceiptHandler } from "@/modules/provider-runtime/index.ts";
import { createWorkerHandlerRegistry } from "@/modules/runtime/server/worker-handler-registry.ts";
import { createWorkerRunnerService } from "@/modules/runtime/server/worker-runner-service.ts";
import { createTransportExecuteHandler } from "@/modules/transport/index.ts";
import type { DeliveryPlan } from "@/modules/delivery/index.ts";
import type { DomainServices } from "@/server/services/index.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("provider runtime persists canonical adapter receipts for outbound Graph email execution", async () => {
  const harness = createRuntimeHarness();
  harness.deliveryPlans.push(makeEmailDeliveryPlan("delivery-plan-provider-1", "wo-provider-1"));

  const queued = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "system", role: "system" },
    now: "2026-05-06T16:00:00.000Z",
    type: "transport.execute",
    payloadVersion: "v1",
    payload: {
      payloadVersion: "v1",
      deliveryPlanId: "delivery-plan-provider-1",
      deliveryType: "escalation.first_response_breach_notification",
      attemptNumber: 0,
      reason: "delivery_scheduled",
      triggerEventType: "delivery_scheduled",
    },
    idempotencyKey: "transport.execute:delivery-plan-provider-1:attempt:0",
    correlationId: "corr-provider-runtime-1",
    causationId: "delivery-plan-provider-1",
    sourceEventId: "event-provider-runtime-1",
    maxAttempts: 1,
  });
  assert.equal(queued.ok, true);

  const runner = createWorkerRunnerService(
    harness.runtime,
    createWorkerHandlerRegistry<DomainServices>([
      createTransportExecuteHandler(),
      createProviderReceiptHandler(),
    ]),
  );
  const processed = await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-provider-runtime",
    now: "2026-05-06T16:01:00.000Z",
    jobTypes: ["transport.execute"],
  });
  assert.equal(processed.ok, true);

  const attempt = harness.deliveryAttempts[0];
  assert.ok(attempt);
  assert.equal(attempt.status, "executing");
  assert.equal(attempt.adapterType, "microsoft_graph_email");
  assert.equal(harness.providerReceipts.length, 1);
  assert.equal(harness.providerReceipts[0]?.providerType, "microsoft_graph_email");
  assert.equal(harness.providerReceipts[0]?.normalizedStatus, "accepted");
  assert.equal(harness.providerReceipts[0]?.reconciliationStatus, "pending");
});

function makeEmailDeliveryPlan(id: string, workOrderId: string): DeliveryPlan {
  return {
    id,
    organizationId: "org-1",
    tenantId: "org-1",
    deliveryType: "escalation.first_response_breach_notification",
    sourceEscalationId: "esc-provider-runtime-1",
    sourceEscalationStageNumber: 1,
    sourceEventId: "event-provider-runtime-1",
    correlationId: "corr-provider-runtime-1",
    causationId: "cause-provider-runtime-1",
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
    nextAttemptAt: "2026-05-06T16:00:00.000Z",
    suppressionReason: null,
    cancellationReason: null,
    activeRuntimeJobId: null,
    noopCount: 0,
    createdAt: "2026-05-06T15:59:00.000Z",
    updatedAt: "2026-05-06T15:59:00.000Z",
  };
}
