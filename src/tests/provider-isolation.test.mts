import assert from "node:assert/strict";
import test from "node:test";

import { createProviderIsolationService } from "@/modules/runtime-capacity/server/provider-isolation-service.ts";
import { createRuntimeQuotaService } from "@/modules/runtime-capacity/server/runtime-quota-service.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("provider instability isolates only the affected tenant provider path", async () => {
  const harness = createRuntimeHarness();
  for (let index = 0; index < 11; index += 1) {
    harness.providerReceipts.push({
      id: `receipt-${index + 1}`,
      organizationId: "org-1",
      tenantId: "org-1",
      providerType: "microsoft_graph_email",
      providerEventType: "message.failed",
      providerMessageId: `message-${index + 1}`,
      providerCorrelationId: null,
      providerReceiptId: `provider-receipt-${index + 1}`,
      deliveryAttemptId: null,
      deliveryPlanId: null,
      sourceWebhookEventId: null,
      correlationId: `corr-${index + 1}`,
      causationId: `cause-${index + 1}`,
      idempotencyKey: `provider.receipt:${index + 1}`,
      normalizedStatus: "failed",
      rawStatus: "failed",
      receivedAt: "2026-05-07T10:00:00.000Z",
      processedAt: null,
      reconciliationStatus: "pending",
      reconciliationReason: null,
      createdAt: "2026-05-07T10:00:00.000Z",
      updatedAt: "2026-05-07T10:00:00.000Z",
      metadata: {},
    });
  }

  const quota = createRuntimeQuotaService({
    repositories: {
      runtimeJobs: harness.repositories.runtimeJobs,
      runtimeDeadLetters: harness.repositories.runtimeDeadLetters,
      deliveryAttempts: harness.repositories.deliveryAttempts,
      escalationOrchestrations: harness.repositories.escalationOrchestrations,
    },
    providerRuntimeStorage: harness.providerRuntime.storage,
  });
  const providerIsolation = createProviderIsolationService(quota);
  const summary = await providerIsolation.getSummary({
    organizationId: "org-1",
    tenantId: "org-1",
    now: "2026-05-07T10:05:00.000Z",
  });

  assert.equal(summary.isolatedProviders.includes("microsoft_graph_email"), true);
  assert.equal(
    await providerIsolation.shouldSuppressProviderJobRetry({
      organizationId: "org-1",
      tenantId: "org-1",
      jobType: "provider.microsoft.replay",
      now: "2026-05-07T10:05:00.000Z",
    }),
    true,
  );
});
