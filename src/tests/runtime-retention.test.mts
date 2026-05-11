import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeArchivalService } from "@/modules/runtime-capacity/server/runtime-archival-service.ts";
import { createRuntimeQuotaService } from "@/modules/runtime-capacity/server/runtime-quota-service.ts";
import { createRuntimeRetentionService } from "@/modules/runtime-capacity/server/runtime-retention-service.ts";
import { createInMemoryRuntimeObservabilityRepositories } from "@/modules/operations/server/runtime-observability-repository.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("retention and archival summaries remain tenant-scoped and preserve auditability", async () => {
  const harness = createRuntimeHarness();
  harness.deadLetters.push({
    id: "dead-1",
    organizationId: "org-1",
    tenantId: "org-1",
    originalJobId: "job-1",
    jobType: "provider.replay",
    payloadSnapshot: null,
    payloadReference: null,
    errorSummary: "failed",
    finalAttemptCount: 3,
    correlationId: "corr-dead-1",
    causationId: "cause-dead-1",
    sourceEventId: null,
    createdAt: "2025-01-01T00:00:00.000Z",
  });
  harness.providerReceipts.push({
    id: "receipt-1",
    organizationId: "org-1",
    tenantId: "org-1",
    providerType: "microsoft_graph_email",
    providerEventType: "message.failed",
    providerMessageId: "message-1",
    providerCorrelationId: null,
    providerReceiptId: "provider-receipt-1",
    deliveryAttemptId: null,
    deliveryPlanId: null,
    sourceWebhookEventId: null,
    correlationId: "corr-1",
    causationId: "cause-1",
    idempotencyKey: "provider.receipt:1",
    normalizedStatus: "failed",
    rawStatus: "failed",
    receivedAt: "2025-01-01T00:00:00.000Z",
    processedAt: null,
    reconciliationStatus: "failed",
    reconciliationReason: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    metadata: {},
  });

  const observability = createInMemoryRuntimeObservabilityRepositories({
    repairActions: [
      {
        id: "repair-1",
        organizationId: "org-1",
        tenantId: "org-1",
        actionType: "dead_letter_replay",
        status: "completed",
        targetType: "runtime_dead_letter",
        targetId: "dead-1",
        idempotencyKey: "repair-1",
        correlationId: "corr-repair-1",
        causationId: "cause-repair-1",
        sourceEventId: null,
        requestedByUserId: "owner-1",
        requestedByRole: "owner",
        summary: "repair",
        metadata: {},
        result: {},
        requestedAt: "2025-01-01T00:00:00.000Z",
        completedAt: "2025-01-01T00:10:00.000Z",
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:10:00.000Z",
      },
    ],
  });
  const quota = createRuntimeQuotaService({
    repositories: {
      runtimeJobs: harness.repositories.runtimeJobs,
      runtimeDeadLetters: harness.repositories.runtimeDeadLetters,
      deliveryAttempts: harness.repositories.deliveryAttempts,
      escalationOrchestrations: harness.repositories.escalationOrchestrations,
    },
    providerRuntimeStorage: harness.providerRuntime.storage,
    observability,
  });
  const retention = createRuntimeRetentionService(
    {
      repositories: {
        runtimeJobs: harness.repositories.runtimeJobs,
        runtimeDeadLetters: harness.repositories.runtimeDeadLetters,
        deliveryAttempts: harness.repositories.deliveryAttempts,
        escalationOrchestrations: harness.repositories.escalationOrchestrations,
      },
      providerRuntimeStorage: harness.providerRuntime.storage,
      observability,
    },
    quota,
  );
  const archival = createRuntimeArchivalService(retention);

  const summary = await retention.getSummary({
    organizationId: "org-1",
    tenantId: "org-1",
    now: "2026-05-07T10:00:00.000Z",
  });
  const archivalSummary = await archival.getSummary({
    organizationId: "org-1",
    tenantId: "org-1",
    now: "2026-05-07T10:00:00.000Z",
  });

  assert.equal(summary.deadLetterHistory.archiveEligibleCount, 1);
  assert.equal(summary.providerReceiptHistory.archiveEligibleCount, 1);
  assert.equal(archivalSummary.preserveAuthoritativeOperationalHistory, true);
});
