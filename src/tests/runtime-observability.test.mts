import assert from "node:assert/strict";
import test from "node:test";

import type { ProviderReceipt } from "@/modules/provider-runtime/index.ts";
import { RUNTIME_REPAIR_ACTION_TYPES } from "@/modules/operations/domain/runtime-repair-action.ts";
import { createInMemoryRuntimeObservabilityRepositories } from "@/modules/operations/server/runtime-observability-repository.ts";
import { createRuntimeOperationsPlatform } from "@/modules/operations/server/runtime-operations-factory.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("runtime observability diagnostics expose replay visibility, alerts, and repair history", async () => {
  const harness = createRuntimeHarness();
  const observabilityRepositories = createInMemoryRuntimeObservabilityRepositories();

  const queued = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    now: "2026-05-06T14:00:00.000Z",
    type: "observability.queue",
    payload: { unit: "obs" },
    payloadVersion: "v1",
    idempotencyKey: "observability.queue:1",
    correlationId: "corr-observability-1",
    causationId: "cause-observability-1",
    sourceEventId: "event-observability-1",
  });
  assert.equal(queued.ok, true);

  harness.eventProcessings.push({
    id: "processing-observability-1",
    organizationId: "org-1",
    tenantId: "org-1",
    subscriberKey: "provider-receipt-reconciliation",
    subscriberName: "Provider Receipt Reconciliation",
    sourceEventId: "event-observability-2",
    eventType: "provider_receipt_recorded",
    correlationId: "corr-observability-2",
    causationId: "event-observability-2",
    idempotencyKey: "processing:observability:1",
    status: "failed",
    attemptCount: 1,
    jobCount: 1,
    jobs: [],
    lastError: {
      code: "receipt_failed",
      message: "provider reconciliation failed",
      retryable: true,
      occurredAt: "2026-05-06T14:00:30.000Z",
      details: {},
    },
    createdAt: "2026-05-06T14:00:30.000Z",
    updatedAt: "2026-05-06T14:00:30.000Z",
    completedAt: "2026-05-06T14:00:30.000Z",
  });
  harness.providerReceipts.push(makeProviderReceipt());

  const operations = createRuntimeOperationsPlatform(
    {
      domainEvents: harness.repositories.domainEvents,
      runtimeJobs: harness.repositories.runtimeJobs,
      runtimeDeadLetters: harness.repositories.runtimeDeadLetters,
      runtimeEventProcessings: harness.repositories.runtimeEventProcessings,
      deliveryPlans: harness.repositories.deliveryPlans,
      deliveryAttempts: harness.repositories.deliveryAttempts,
      escalationOrchestrations: harness.repositories.escalationOrchestrations,
      slaTimers: harness.repositories.slaTimers,
    },
    {
      runtime: harness.runtime,
      providerRuntime: harness.providerRuntime,
      delivery: harness.delivery,
    },
    observabilityRepositories,
  );

  const repair = await operations.repair.execute({
    organizationId: "org-1",
    actor: { userId: "owner-1", role: "owner" },
    actionType: RUNTIME_REPAIR_ACTION_TYPES.EventReplayRetry,
    targetId: "event-observability-2",
    idempotencyKey: "repair-observability-event-1",
    now: "2026-05-06T14:01:00.000Z",
  });
  assert.equal(repair.ok, true);

  const diagnostics = await operations.observability.getDiagnostics({
    organizationId: "org-1",
    now: "2026-05-06T14:02:00.000Z",
  });

  assert.equal(diagnostics.replay.reconciliationFailureCount, 1);
  assert.equal(diagnostics.replay.recentEventProcessings.length >= 1, true);
  assert.equal(diagnostics.repairHistory.length, 1);
  assert.equal(diagnostics.alerts.some((item) => item.alertType === "provider_reconciliation_failures"), true);
  assert.equal(diagnostics.freshness.projectionLagMs >= 0, true);
});

function makeProviderReceipt(): ProviderReceipt {
  return {
    id: "provider-receipt-observability-1",
    organizationId: "org-1",
    tenantId: "org-1",
    providerType: "microsoft_graph_email",
    providerEventType: "message.failed",
    providerMessageId: "graph-message-observability-1",
    providerCorrelationId: "graph-correlation-observability-1",
    providerReceiptId: "graph-receipt-observability-1",
    deliveryAttemptId: null,
    deliveryPlanId: null,
    sourceWebhookEventId: "provider-webhook-observability-1",
    correlationId: "corr-observability-provider-1",
    causationId: "provider-webhook-observability-1",
    idempotencyKey: "provider.receipt:observability:1",
    normalizedStatus: "failed",
    rawStatus: "failed",
    receivedAt: "2026-05-06T14:00:45.000Z",
    processedAt: "2026-05-06T14:00:50.000Z",
    reconciliationStatus: "failed",
    reconciliationReason: "delivery_attempt_not_found",
    createdAt: "2026-05-06T14:00:45.000Z",
    updatedAt: "2026-05-06T14:00:50.000Z",
    metadata: {},
  };
}
