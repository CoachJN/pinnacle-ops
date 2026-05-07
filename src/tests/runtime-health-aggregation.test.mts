import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeHealthService } from "@/modules/operations/server/runtime-health-service.ts";

test("runtime health aggregation deterministically classifies critical runtime conditions", () => {
  const health = createRuntimeHealthService();
  const result = health.evaluate({
    now: "2026-05-06T12:00:00.000Z",
    projection: {
      id: "runtime-projection:org-1",
      organizationId: "org-1",
      tenantId: "org-1",
      healthStatus: "healthy",
      generatedAt: "2026-05-06T12:00:00.000Z",
      latestObservedUpdateAt: "2026-05-06T11:59:00.000Z",
      projectionLagMs: 60_000,
      queue: {
        totalJobCount: 15,
        queuedCount: 8,
        leasedCount: 1,
        runningCount: 2,
        failedCount: 1,
        deadLetteredCount: 5,
        overdueQueuedCount: 6,
        expiredLeaseCount: 3,
        retryStormCount: 12,
        oldestQueuedAt: "2026-05-06T11:20:00.000Z",
        queueLagMs: 2_400_000,
      },
      replay: {
        totalEventProcessings: 20,
        failedEventProcessings: 6,
        successfulEventProcessings: 14,
        replayBacklogCount: 6,
        pendingProviderReceipts: 3,
        failedProviderReceipts: 5,
        ignoredProviderReceipts: 0,
        unresolvedProviderReceipts: 2,
      },
      provider: {
        duplicateWebhookCount: 0,
        reconciliationFailures: 5,
        pendingReceiptCount: 3,
        providerDeliverySummaries: [],
      },
      stuck: {
        stuckRuntimeJobIds: ["job-1", "job-2", "job-3"],
        overdueSlaTimerIds: ["sla-1", "sla-2", "sla-3"],
        failedDeliveryPlanIds: [],
        failedTransportAttemptIds: [],
        unresolvedProviderReceiptIds: ["receipt-1"],
      },
      totals: {
        slaTimerCount: 10,
        overdueSlaTimerCount: 3,
        activeEscalationCount: 1,
        openDeliveryPlanCount: 1,
        failedDeliveryPlanCount: 0,
        transportAttemptCount: 2,
        retryScheduledAttemptCount: 0,
        failedTransportAttemptCount: 0,
        deadLetterCount: 5,
      },
      tenantSummary: {
        organizationId: "org-1",
        activeRuntimeWorkCount: 12,
        interventionRequiredCount: 14,
      },
      trends: {
        deadLetterDelta: 2,
        replayBacklogDelta: 1,
        failedReceiptDelta: 1,
        queueLagDeltaMs: 120_000,
      },
      createdAt: "2026-05-06T11:00:00.000Z",
      updatedAt: "2026-05-06T12:00:00.000Z",
    },
  });

  assert.equal(result.status, "critical");
  assert.equal(result.indicators.some((item) => item.code === "dead_letters_critical"), true);
  assert.equal(result.indicators.some((item) => item.code === "retry_storm"), true);
  assert.equal(result.indicators.some((item) => item.code === "queue_starvation"), true);
});
