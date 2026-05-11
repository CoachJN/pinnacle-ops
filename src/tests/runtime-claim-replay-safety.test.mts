import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeClaimService } from "@/modules/runtime-claim";
import { createRuntimeCapacityServices } from "@/modules/runtime-capacity/server/runtime-capacity-factory";
import { createRuntimeHarness } from "@/tests/support/runtime-harness.ts";
import {
  createInMemoryRuntimeClaimSourceRepository,
  createInMemoryRuntimeClaimWindowRepository,
} from "@/tests/support/runtime-claim-test-utils.ts";

test("duplicate allocator execution does not double-claim the same tenant window", async () => {
  const harness = createRuntimeHarness();
  const now = "2026-05-07T12:05:00.000Z";

  await harness.runtime.jobs.enqueue({
    actor: { userId: "user-1", role: "system" },
    organizationId: "tenant-a",
    tenantId: "tenant-a",
    type: "runtime.standard",
    payload: {},
    payloadVersion: "v1",
    idempotencyKey: "tenant-a-1",
    correlationId: "corr-a-1",
    causationId: "cause-a-1",
    now,
  });

  const windows = createInMemoryRuntimeClaimWindowRepository();
  const source = createInMemoryRuntimeClaimSourceRepository(harness.jobs, harness.providerReceipts);
  const capacity = createRuntimeCapacityServices({
    repositories: harness.repositories,
    providerRuntimeStorage: harness.providerRuntime.storage,
  });
  const service = createRuntimeClaimService({ ...source, ...windows }, harness.runtime.lease, capacity.guardrails);
  const decision = {
    tenantId: "tenant-a",
    organizationId: "tenant-a",
    fairnessWeight: 1,
    allocatorWindowId: "allocator-window-1",
    shardId: "runtime-shard-1",
    pressureState: "normal" as const,
    quotaHeadroom: 4,
    replayPressure: 0,
    providerPressure: "normal" as const,
    claimDecisionReason: null,
    grantedClaims: 1,
    effectiveWeight: 1,
    oldestQueueWaitMs: 1_000,
    starvationPrevented: false,
  };

  const first = await service.materializeDecision({
    allocatorId: "allocator-a",
    workerPoolId: "pool-a",
    workerId: "worker-a",
    decision,
    now,
    leaseDurationMs: 60_000,
  });
  const duplicate = await service.materializeDecision({
    allocatorId: "allocator-a",
    workerPoolId: "pool-a",
    workerId: "worker-b",
    decision,
    now,
    leaseDurationMs: 60_000,
  });

  assert.equal(first.id, duplicate.id);
  assert.equal(harness.jobs.filter((job) => job.status === "leased").length, 1);
});
