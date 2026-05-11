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

test("allocator execution materializes tenant-aware fair claims through canonical leases", async () => {
  const harness = createRuntimeHarness();
  const now = "2026-05-07T12:05:00.000Z";

  for (const [organizationId, idempotencyKey] of [
    ["tenant-a", "tenant-a-1"],
    ["tenant-a", "tenant-a-2"],
    ["tenant-b", "tenant-b-1"],
  ] as const) {
    await harness.runtime.jobs.enqueue({
      actor: { userId: "user-1", role: "system" },
      organizationId,
      tenantId: organizationId,
      type: "runtime.standard",
      payload: {},
      payloadVersion: "v1",
      idempotencyKey,
      correlationId: `corr-${idempotencyKey}`,
      causationId: `cause-${idempotencyKey}`,
      now,
    });
  }

  const allocator = createRuntimeAllocatorService(
    createInMemoryAllocatorGlobalRepository(harness.jobs, harness.providerReceipts),
  );
  const windows = createInMemoryRuntimeClaimWindowRepository();
  const workers = createInMemoryRuntimeClaimWorkerRepository();
  const recovery = createInMemoryRuntimeClaimRecoveryRepository();
  const source = createInMemoryRuntimeClaimSourceRepository(harness.jobs, harness.providerReceipts);
  const capacity = createRuntimeCapacityServices({
    repositories: harness.repositories,
    providerRuntimeStorage: harness.providerRuntime.storage,
  });

  const execution = createAllocatorExecutionService(
    allocator,
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
    workerId: "worker-a",
    now,
    shardCount: 1,
    totalCapacity: 2,
  });

  assert.equal(result.allocation.claimedCapacity, 2);
  assert.equal(result.windows.length, 2);
  assert.deepEqual(
    result.windows.map((window) => window.tenantId).sort(),
    ["tenant-a", "tenant-b"],
  );
  assert.equal(harness.jobs.filter((job) => job.status === "leased").length, 2);
});
