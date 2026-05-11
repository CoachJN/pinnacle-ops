import assert from "node:assert/strict";
import test from "node:test";

import { createProviderReconciliationSweepHandler } from "@/modules/scheduler/server/handlers/provider-reconciliation-sweep-handler.ts";
import { createWorkerHandlerRegistry } from "@/modules/runtime/server/worker-handler-registry.ts";
import { createWorkerRunnerService } from "@/modules/runtime/server/worker-runner-service.ts";
import type { ProviderReceipt } from "@/modules/provider-runtime/index.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("provider reconciliation sweep enforces bounded batch limits", async () => {
  const harness = createRuntimeHarness();
  for (let index = 0; index < 60; index += 1) {
    harness.providerReceipts.push(makePendingReceipt(index));
  }

  const queued = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "system", role: "system" },
    now: "2026-05-07T12:00:00.000Z",
    type: "provider.reconciliation.sweep",
    payloadVersion: "v1",
    payload: {
      payloadVersion: "v1",
      scheduledTaskId: "runtime-scheduled-task:org-1:provider.reconciliation.sweep",
      scheduledFor: "2026-05-07T12:00:00.000Z",
      batchLimit: 500,
      taskType: "provider.reconciliation.sweep",
    },
    idempotencyKey: "scheduled:provider.sweep:1",
    correlationId: "scheduler:org-1:provider.reconciliation.sweep",
    causationId: "scheduler:provider-sweep",
    sourceEventId: null,
  });
  assert.equal(queued.ok, true);

  const runner = createWorkerRunnerService(
    harness.runtime,
    createWorkerHandlerRegistry([createProviderReconciliationSweepHandler()]),
  );
  const result = await runner.processPending({
    organizationId: "org-1",
    services: {
      runtime: harness.runtime,
      providerRuntime: harness.providerRuntime,
    } as never,
    workerId: "provider-sweep-worker-1",
    now: "2026-05-07T12:00:05.000Z",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.completedCount, 1);

  const reconciliationJobs = harness.jobs.filter((job) => job.type === "provider.receipt.process");
  assert.equal(reconciliationJobs.length, 50);
});

function makePendingReceipt(index: number): ProviderReceipt {
  const id = `provider-receipt-${index + 1}`;
  return {
    id,
    organizationId: "org-1",
    tenantId: "org-1",
    providerType: "microsoft_graph_email",
    providerEventType: "message.failed",
    providerMessageId: `message-${index + 1}`,
    providerCorrelationId: `correlation-${index + 1}`,
    providerReceiptId: `receipt-${index + 1}`,
    deliveryAttemptId: null,
    deliveryPlanId: null,
    sourceWebhookEventId: `webhook-${index + 1}`,
    correlationId: `corr-${index + 1}`,
    causationId: `webhook-${index + 1}`,
    idempotencyKey: `provider.receipt:${id}`,
    normalizedStatus: "failed",
    rawStatus: "failed",
    receivedAt: "2026-05-07T11:59:00.000Z",
    processedAt: null,
    reconciliationStatus: "pending",
    reconciliationReason: null,
    createdAt: "2026-05-07T11:59:00.000Z",
    updatedAt: "2026-05-07T11:59:00.000Z",
    metadata: {},
  };
}
