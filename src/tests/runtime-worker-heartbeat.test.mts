import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeWorkerHeartbeatService } from "@/modules/runtime-claim";
import {
  createInMemoryRuntimeClaimRecoveryRepository,
  createInMemoryRuntimeClaimWorkerRepository,
} from "@/tests/support/runtime-claim-test-utils.ts";

test("allocator worker heartbeats track active ownership and expire stale workers", async () => {
  const workers = createInMemoryRuntimeClaimWorkerRepository();
  const recovery = createInMemoryRuntimeClaimRecoveryRepository();
  const service = createRuntimeWorkerHeartbeatService(workers, recovery);

  const heartbeat = await service.heartbeat({
    workerId: "worker-a",
    allocatorId: "allocator-a",
    workerPoolId: "pool-a",
    shardIds: ["runtime-shard-1"],
    activeWindowKeys: ["window-a"],
    activeClaimCount: 2,
    desiredConcurrency: 2,
    maxConcurrency: 2,
    now: "2026-05-07T12:00:00.000Z",
    leaseDurationMs: 60_000,
  });
  assert.equal(heartbeat.healthState, "active");

  const recoveries = await service.expireStaleWorkers({
    allocatorId: "allocator-a",
    workerPoolId: "pool-a",
    now: "2026-05-07T12:02:00.000Z",
  });
  assert.equal(recoveries.length, 1);
  assert.equal((await workers.getWorker("worker-a"))?.healthState, "expired");
});
