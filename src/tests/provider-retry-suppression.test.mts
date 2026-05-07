import assert from "node:assert/strict";
import test from "node:test";

import type { DeliveryPlan } from "@/modules/delivery/index.ts";
import type { DeliveryAttempt } from "@/modules/transport/index.ts";
import type { ProviderReceipt } from "@/modules/provider-runtime/index.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("late provider success suppresses redundant retries safely", async () => {
  const harness = createRuntimeHarness();
  const plan = makeEmailDeliveryPlan("delivery-plan-provider-3", "wo-provider-3");
  harness.deliveryPlans.push(plan);
  const attempt = makeRetryScheduledAttempt(plan);
  harness.deliveryAttempts.push(attempt);
  harness.providerReceipts.push(makeReceipt({
    id: "provider-receipt-late-success",
    deliveryAttemptId: attempt.id,
    deliveryPlanId: plan.id,
    normalizedStatus: "delivered",
    providerMessageId: attempt.providerMessageId,
    providerReceiptId: attempt.providerReceiptId,
    receivedAt: "2026-05-06T18:10:00.000Z",
  }));

  const reconciled = await harness.providerRuntime.reconciliation.reconcileReceipt({
    organizationId: "org-1",
    receiptId: "provider-receipt-late-success",
    now: "2026-05-06T18:11:00.000Z",
  });

  assert.equal(reconciled.ok, true);
  assert.equal(reconciled.value.retrySuppressed, true);
  assert.equal(harness.deliveryAttempts[0]?.status, "succeeded");
  assert.equal(harness.deliveryAttempts[0]?.nextRetryAt, null);
  assert.equal(harness.deliveryPlans[0]?.status, "completed");
  assert.equal(harness.providerReceipts[0]?.reconciliationReason, "late_success_retry_suppressed");
});

function makeEmailDeliveryPlan(id: string, workOrderId: string): DeliveryPlan {
  return {
    id,
    organizationId: "org-1",
    tenantId: "org-1",
    deliveryType: "escalation.first_response_breach_notification",
    sourceEscalationId: "esc-provider-runtime-3",
    sourceEscalationStageNumber: 1,
    sourceEventId: "event-provider-runtime-3",
    correlationId: "corr-provider-runtime-3",
    causationId: "cause-provider-runtime-3",
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
    retryCount: 1,
    nextAttemptAt: "2026-05-06T18:30:00.000Z",
    suppressionReason: null,
    cancellationReason: null,
    activeRuntimeJobId: "job-retry-provider-3",
    noopCount: 0,
    createdAt: "2026-05-06T17:59:00.000Z",
    updatedAt: "2026-05-06T18:00:00.000Z",
  };
}

function makeRetryScheduledAttempt(plan: DeliveryPlan): DeliveryAttempt {
  return {
    id: "attempt-provider-3",
    organizationId: plan.organizationId,
    tenantId: plan.tenantId,
    deliveryPlanId: plan.id,
    deliveryType: plan.deliveryType,
    channel: plan.channel,
    adapterType: "microsoft_graph_email",
    sourceEventId: plan.sourceEventId,
    correlationId: plan.correlationId,
    causationId: plan.causationId,
    idempotencyKey: "delivery.attempt:provider-3:1",
    status: "retry_scheduled",
    providerMessageId: "graph-message-provider-3",
    providerCorrelationId: "graph-correlation-provider-3",
    providerReceiptId: "graph-receipt-provider-3",
    retryCount: 1,
    nextRetryAt: "2026-05-06T18:30:00.000Z",
    executionStartedAt: "2026-05-06T18:00:00.000Z",
    executionCompletedAt: "2026-05-06T18:00:05.000Z",
    failureCode: "graph_timeout",
    failureReason: "temporary provider timeout",
    emittedEventIds: [],
    createdAt: "2026-05-06T18:00:00.000Z",
    updatedAt: "2026-05-06T18:00:05.000Z",
  };
}

function makeReceipt(input: {
  id: string;
  deliveryAttemptId: string;
  deliveryPlanId: string;
  normalizedStatus: ProviderReceipt["normalizedStatus"];
  providerMessageId: string | null;
  providerReceiptId: string | null;
  receivedAt: string;
}): ProviderReceipt {
  return {
    id: input.id,
    organizationId: "org-1",
    tenantId: "org-1",
    providerType: "microsoft_graph_email",
    providerEventType: "message.delivered",
    providerMessageId: input.providerMessageId,
    providerCorrelationId: "graph-correlation-provider-3",
    providerReceiptId: input.providerReceiptId,
    deliveryAttemptId: input.deliveryAttemptId,
    deliveryPlanId: input.deliveryPlanId,
    sourceWebhookEventId: "provider-webhook-3",
    correlationId: "corr-provider-runtime-3",
    causationId: "provider-webhook-3",
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
