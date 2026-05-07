import assert from "node:assert/strict";
import test from "node:test";

import type { ProviderReceipt } from "@/modules/provider-runtime/index.ts";
import {
  createInMemoryRuntimeObservabilityRepositories,
} from "@/modules/operations/server/runtime-observability-repository.ts";
import { createRuntimeOperationsPlatform } from "@/modules/operations/server/runtime-operations-factory.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("runtime projection aggregates canonical runtime state into a persisted command-center snapshot", async () => {
  const harness = createRuntimeHarness();
  const observabilityRepositories = createInMemoryRuntimeObservabilityRepositories();

  const queued = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    now: "2026-05-06T10:00:00.000Z",
    type: "projection.queue",
    payload: { value: 1 },
    payloadVersion: "v1",
    idempotencyKey: "projection.queue:1",
    correlationId: "corr-projection-1",
    causationId: "cause-projection-1",
    sourceEventId: "event-projection-1",
  });
  assert.equal(queued.ok, true);

  const claimed = await harness.runtime.lease.claimNext({
    organizationId: "org-1",
    workerId: "worker-projection",
    leaseDurationMs: 60_000,
    now: "2026-05-06T10:01:00.000Z",
  });
  assert.equal(claimed.ok, true);
  assert.ok(claimed.value);
  harness.jobs[0] = {
    ...claimed.value,
    status: "running",
    leaseExpiresAt: "2026-05-06T10:02:00.000Z",
    updatedAt: "2026-05-06T10:01:00.000Z",
  };

  harness.deadLetters.push({
    id: "dead-letter-projection-1",
    organizationId: "org-1",
    tenantId: "org-1",
    originalJobId: claimed.value.id,
    jobType: claimed.value.type,
    payloadSnapshot: { value: 1 },
    payloadReference: null,
    errorSummary: "projection failure",
    finalAttemptCount: 2,
    correlationId: claimed.value.correlationId,
    causationId: claimed.value.id,
    sourceEventId: claimed.value.sourceEventId,
    createdAt: "2026-05-06T10:03:00.000Z",
  });
  harness.eventProcessings.push({
    id: "processing-projection-1",
    organizationId: "org-1",
    tenantId: "org-1",
    subscriberKey: "delivery-transport-execution",
    subscriberName: "Delivery Transport Execution",
    sourceEventId: "event-projection-2",
    eventType: "delivery_scheduled",
    correlationId: "corr-projection-2",
    causationId: "event-projection-2",
    idempotencyKey: "processing:projection:1",
    status: "failed",
    attemptCount: 2,
    jobCount: 1,
    jobs: [],
    lastError: {
      code: "subscriber_failed",
      message: "runtime subscriber failed",
      retryable: true,
      occurredAt: "2026-05-06T10:04:00.000Z",
      details: {},
    },
    createdAt: "2026-05-06T10:04:00.000Z",
    updatedAt: "2026-05-06T10:04:00.000Z",
    completedAt: "2026-05-06T10:04:00.000Z",
  });
  harness.slaTimers.push(makeScheduledTimer("sla-projection-1", "wo-projection-1"));
  harness.providerReceipts.push(
    makeProviderReceipt({
      id: "provider-receipt-projection-1",
      reconciliationStatus: "failed",
      reconciliationReason: "delivery_attempt_not_found",
      receivedAt: "2026-05-06T10:05:00.000Z",
    }),
  );

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

  const refreshed = await operations.projection.refresh({
    organizationId: "org-1",
    now: "2026-05-06T10:10:00.000Z",
  });

  assert.equal(refreshed.projection.totals.deadLetterCount, 1);
  assert.equal(refreshed.projection.queue.expiredLeaseCount, 1);
  assert.equal(refreshed.projection.replay.replayBacklogCount, 1);
  assert.equal(refreshed.projection.replay.failedProviderReceipts, 1);
  assert.equal(refreshed.projection.totals.overdueSlaTimerCount, 1);
  assert.equal(refreshed.projection.tenantSummary.interventionRequiredCount, 5);

  const persisted = await observabilityRepositories.projections.getByOrganizationId("org-1");
  assert.ok(persisted);
  assert.equal(persisted?.id, refreshed.projection.id);
  assert.equal(persisted?.projectionLagMs >= 0, true);
});

function makeScheduledTimer(id: string, workOrderId: string) {
  return {
    id,
    organizationId: "org-1",
    tenantId: "org-1",
    type: "work_order.first_response_due" as const,
    targetEntityType: "work_order" as const,
    targetEntityId: workOrderId,
    status: "scheduled" as const,
    dueAt: "2026-05-06T09:55:00.000Z",
    policyVersion: "v1",
    payloadVersion: "v1",
    condition: {
      kind: "work_order_first_response" as const,
      workOrderId,
      activationEventId: "event-sla-projection-1",
      activationEventType: "work_order_created" as const,
      activationOccurredAt: "2026-05-06T09:00:00.000Z",
      initialLifecycleStatus: "new",
    },
    sourceEventId: "event-sla-projection-1",
    correlationId: "corr-sla-projection-1",
    causationId: "event-sla-projection-1",
    idempotencyKey: `sla:${id}`,
    runtimeJobId: null,
    evaluatedAt: null,
    satisfiedAt: null,
    breachedAt: null,
    cancelledAt: null,
    failureReason: null,
    createdAt: "2026-05-06T09:00:00.000Z",
    updatedAt: "2026-05-06T09:00:00.000Z",
  };
}

function makeProviderReceipt(input: {
  id: string;
  reconciliationStatus: ProviderReceipt["reconciliationStatus"];
  reconciliationReason: string | null;
  receivedAt: string;
}): ProviderReceipt {
  return {
    id: input.id,
    organizationId: "org-1",
    tenantId: "org-1",
    providerType: "microsoft_graph_email",
    providerEventType: "message.failed",
    providerMessageId: "graph-message-projection-1",
    providerCorrelationId: "graph-correlation-projection-1",
    providerReceiptId: "graph-receipt-projection-1",
    deliveryAttemptId: null,
    deliveryPlanId: null,
    sourceWebhookEventId: "provider-webhook-projection-1",
    correlationId: "corr-provider-projection-1",
    causationId: "provider-webhook-projection-1",
    idempotencyKey: `provider.receipt:${input.id}`,
    normalizedStatus: "failed",
    rawStatus: "failed",
    receivedAt: input.receivedAt,
    processedAt: "2026-05-06T10:06:00.000Z",
    reconciliationStatus: input.reconciliationStatus,
    reconciliationReason: input.reconciliationReason,
    createdAt: input.receivedAt,
    updatedAt: "2026-05-06T10:06:00.000Z",
    metadata: {},
  };
}
