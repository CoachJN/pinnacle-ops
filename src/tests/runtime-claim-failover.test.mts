import assert from "node:assert/strict";
import test from "node:test";

import {
  createAllocatorLeaseService,
  createRuntimeAllocatorService,
} from "@/modules/runtime-allocator";
import {
  createAllocatorExecutionService,
  createRuntimeClaimBalancerService,
  createRuntimeClaimService,
  createRuntimeWorkerHeartbeatService,
  createRuntimeWorkerScalingService,
} from "@/modules/runtime-claim";
import { createRuntimeCapacityServices } from "@/modules/runtime-capacity/server/runtime-capacity-factory";
import {
  createInMemoryAllocatorGlobalRepository,
  createInMemoryAllocatorLeaseRepository,
} from "@/tests/support/runtime-allocator-test-utils.ts";
import { createRuntimeHarness } from "@/tests/support/runtime-harness.ts";
import {
  createInMemoryRuntimeClaimRecoveryRepository,
  createInMemoryRuntimeClaimSourceRepository,
  createInMemoryRuntimeClaimWindowRepository,
  createInMemoryRuntimeClaimWorkerRepository,
} from "@/tests/support/runtime-claim-test-utils.ts";

test("expired allocator workers recover deterministically and allow safe reassignment", async () => {
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

  const workers = createInMemoryRuntimeClaimWorkerRepository([
    {
      workerId: "pool-a-worker-1",
      allocatorId: "allocator-a",
      workerPoolId: "pool-a",
      shardIds: ["runtime-shard-1"],
      activeWindowKeys: ["stale-window"],
      activeClaimCount: 1,
      healthState: "active",
      desiredConcurrency: 1,
      maxConcurrency: 1,
      heartbeatAt: "2026-05-07T12:00:00.000Z",
      leaseExpiresAt: "2026-05-07T12:01:00.000Z",
      createdAt: "2026-05-07T12:00:00.000Z",
      updatedAt: "2026-05-07T12:00:00.000Z",
    },
  ]);
  const recovery = createInMemoryRuntimeClaimRecoveryRepository();
  const windows = createInMemoryRuntimeClaimWindowRepository();
  const source = createInMemoryRuntimeClaimSourceRepository(harness.jobs, harness.providerReceipts);
  const capacity = createRuntimeCapacityServices({
    repositories: harness.repositories,
    providerRuntimeStorage: harness.providerRuntime.storage,
  });

  const execution = createAllocatorExecutionService(
    createRuntimeAllocatorService(createInMemoryAllocatorGlobalRepository(harness.jobs, harness.providerReceipts)),
    createAllocatorLeaseService(createInMemoryAllocatorLeaseRepository()),
    createRuntimeClaimBalancerService(),
    createRuntimeClaimService({ ...source, ...windows }, harness.runtime.lease, capacity.guardrails),
    createRuntimeWorkerHeartbeatService(workers, recovery),
    createRuntimeWorkerScalingService(),
    windows,
  );

  const result = await execution.materialize({
    allocatorId: "allocator-a",
    leaseOwner: "owner-a",
    workerPoolId: "pool-a",
    workerId: "pool-a-worker-2",
    now,
    shardCount: 1,
    totalCapacity: 1,
  });

  assert.equal(result.recoveries, 1);
  assert.equal(result.windows[0]?.claimedCount, 1);
  assert.equal((await recovery.listRecentEvents()).length, 1);
});
