import assert from "node:assert/strict";
import test from "node:test";

import type { DeliveryPlan } from "@/modules/delivery/index.ts";
import type { DeliveryAttempt } from "@/modules/transport/index.ts";
import type { ProviderReceipt } from "@/modules/provider-runtime/index.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("out-of-order and replayed provider receipts do not corrupt canonical delivery state", async () => {
  const harness = createRuntimeHarness();
  const plan = makeEmailDeliveryPlan("delivery-plan-provider-4", "wo-provider-4");
  const attempt = makeExecutingAttempt(plan);
  harness.deliveryPlans.push(plan);
  harness.deliveryAttempts.push(attempt);

  harness.providerReceipts.push(makeReceipt({
    id: "provider-receipt-delivered-4",
    normalizedStatus: "delivered",
    providerEventType: "message.delivered",
    receivedAt: "2026-05-06T19:05:00.000Z",
  }));
  const delivered = await harness.providerRuntime.reconciliation.reconcileReceipt({
    organizationId: "org-1",
    receiptId: "provider-receipt-delivered-4",
    now: "2026-05-06T19:05:30.000Z",
  });
  assert.equal(delivered.ok, true);
  assert.equal(harness.deliveryAttempts[0]?.status, "succeeded");

  harness.providerReceipts.push(makeReceipt({
    id: "provider-receipt-accepted-4",
    normalizedStatus: "accepted",
    providerEventType: "message.accepted",
    receivedAt: "2026-05-06T19:06:00.000Z",
  }));
  const acceptedReplay = await harness.providerRuntime.reconciliation.reconcileReceipt({
    organizationId: "org-1",
    receiptId: "provider-receipt-accepted-4",
    now: "2026-05-06T19:06:30.000Z",
  });
  assert.equal(acceptedReplay.ok, true);
  assert.equal(acceptedReplay.value.status, "ignored_out_of_order");
  assert.equal(harness.deliveryAttempts[0]?.status, "succeeded");

  const deliveredReplay = await harness.providerRuntime.reconciliation.reconcileReceipt({
    organizationId: "org-1",
    receiptId: "provider-receipt-delivered-4",
    now: "2026-05-06T19:07:00.000Z",
  });
  assert.equal(deliveredReplay.ok, true);
  assert.equal(deliveredReplay.value.status, "duplicate_noop");
  assert.equal(harness.workOrders.length, 0);
});

function makeEmailDeliveryPlan(id: string, workOrderId: string): DeliveryPlan {
  return {
    id,
    organizationId: "org-1",
    tenantId: "org-1",
    deliveryType: "escalation.first_response_breach_notification",
    sourceEscalationId: "esc-provider-runtime-4",
    sourceEscalationStageNumber: 1,
    sourceEventId: "event-provider-runtime-4",
    correlationId: "corr-provider-runtime-4",
    causationId: "cause-provider-runtime-4",
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
    nextAttemptAt: null,
    suppressionReason: null,
    cancellationReason: null,
    activeRuntimeJobId: "job-provider-runtime-4",
    noopCount: 0,
    createdAt: "2026-05-06T18:59:00.000Z",
    updatedAt: "2026-05-06T18:59:00.000Z",
  };
}

function makeExecutingAttempt(plan: DeliveryPlan): DeliveryAttempt {
  return {
    id: "attempt-provider-4",
    organizationId: plan.organizationId,
    tenantId: plan.tenantId,
    deliveryPlanId: plan.id,
    deliveryType: plan.deliveryType,
    channel: plan.channel,
    adapterType: "microsoft_graph_email",
    sourceEventId: plan.sourceEventId,
    correlationId: plan.correlationId,
    causationId: plan.causationId,
    idempotencyKey: "delivery.attempt:provider-4:0",
    status: "executing",
    providerMessageId: "graph-message-provider-4",
    providerCorrelationId: "graph-correlation-provider-4",
    providerReceiptId: "graph-receipt-provider-4",
    retryCount: 0,
    nextRetryAt: null,
    executionStartedAt: "2026-05-06T19:00:00.000Z",
    executionCompletedAt: null,
    failureCode: null,
    failureReason: null,
    emittedEventIds: [],
    createdAt: "2026-05-06T19:00:00.000Z",
    updatedAt: "2026-05-06T19:00:00.000Z",
  };
}

function makeReceipt(input: {
  id: string;
  normalizedStatus: ProviderReceipt["normalizedStatus"];
  providerEventType: string;
  receivedAt: string;
}): ProviderReceipt {
  return {
    id: input.id,
    organizationId: "org-1",
    tenantId: "org-1",
    providerType: "microsoft_graph_email",
    providerEventType: input.providerEventType,
    providerMessageId: "graph-message-provider-4",
    providerCorrelationId: "graph-correlation-provider-4",
    providerReceiptId: "graph-receipt-provider-4",
    deliveryAttemptId: "attempt-provider-4",
    deliveryPlanId: "delivery-plan-provider-4",
    sourceWebhookEventId: `provider-webhook-${input.id}`,
    correlationId: "corr-provider-runtime-4",
    causationId: `provider-webhook-${input.id}`,
    idempotencyKey: `provider.receipt:${input.id}`,
    normalizedStatus: input.normalizedStatus,
    rawStatus: input.normalizedStatus,
    receivedAt: input.receivedAt,
    processedAt: null,
    reconciliationStatus: "pending",
    reconciliationReason: null,
    createdAt: input.receivedAt,
    updatedAt: input.receivedAt,
    metadata: {},
  };
}
