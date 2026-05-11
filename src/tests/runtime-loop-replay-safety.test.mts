import assert from "node:assert/strict";
import test from "node:test";

import { createProviderReconciliationLoopRunner } from "@/modules/runtime-loops/server/provider-reconciliation-loop-runner.ts";
import {
  createInMemoryRuntimeLoopRepositories,
  createRuntimeDrainService,
  createRuntimeLoopCoordinator,
  createRuntimeLoopHeartbeatService,
  createRuntimeLoopService,
} from "@/modules/runtime-loops/index.ts";
import { createRuntimeHarness } from "@/tests/support/runtime-harness.ts";

test("provider reconciliation cadence is replay-safe within the same cadence window", async () => {
  const harness = createRuntimeHarness();
  const now = "2026-05-07T14:00:00.000Z";

  await harness.providerRuntime.storage.receipts.create({
    id: "receipt-1",
    organizationId: "org-1",
    tenantId: "org-1",
    providerType: "microsoft_graph_email",
    providerEventType: "delivered",
    providerMessageId: "message-1",
    providerCorrelationId: "correlation-1",
    providerReceiptId: "provider-receipt-1",
    deliveryAttemptId: null,
    deliveryPlanId: null,
    sourceWebhookEventId: null,
    correlationId: "corr-1",
    causationId: "cause-1",
    idempotencyKey: "receipt-idempotency-1",
    normalizedStatus: "delivered",
    rawStatus: "delivered",
    receivedAt: now,
    processedAt: null,
    reconciliationStatus: "pending",
    reconciliationReason: null,
    createdAt: now,
    updatedAt: now,
    metadata: {},
  });

  const repositories = createInMemoryRuntimeLoopRepositories();
  const loopService = createRuntimeLoopService(repositories.loops);
  const heartbeat = createRuntimeLoopHeartbeatService(
    repositories.loops,
    loopService,
    repositories.events,
  );
  const drain = createRuntimeDrainService(
    repositories.state,
    repositories.events,
    repositories.loops,
  );
  const coordinator = createRuntimeLoopCoordinator(
    loopService,
    heartbeat,
    drain,
    repositories.results,
    repositories.loops,
  );
  const runner = createProviderReconciliationLoopRunner(
    coordinator,
    harness.runtime.jobs,
    harness.providerRuntime.storage.receipts,
  );

  const first = await runner.runCycle({
    organizationId: "org-1",
    leaseOwner: "reconcile-owner-a",
    now,
    cadence: 60_000,
    concurrencyLimit: 1,
    leaseDurationMs: 1_000,
    batchLimit: 25,
  });
  const replay = await runner.runCycle({
    organizationId: "org-1",
    leaseOwner: "reconcile-owner-a",
    now: "2026-05-07T14:00:10.000Z",
    cadence: 60_000,
    concurrencyLimit: 1,
    leaseDurationMs: 1_000,
    batchLimit: 25,
  });

  assert.equal(first.result.enqueuedCount, 1);
  assert.equal(replay.result.enqueuedCount, 0);
  assert.equal(replay.result.duplicateCount, 1);
  assert.equal(
    harness.jobs.filter((job) => job.type === "provider.reconciliation.sweep").length,
    1,
  );
});
