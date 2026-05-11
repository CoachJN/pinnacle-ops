import assert from "node:assert/strict";
import test from "node:test";

import {
  createAllocatorHealthService,
  createAllocatorLeaseService,
} from "@/modules/runtime-allocator";
import { createInMemoryAllocatorLeaseRepository } from "@/tests/support/runtime-allocator-test-utils.ts";

test("allocator health exposes expired shard leases and recoverable failover state", async () => {
  const leases = createInMemoryAllocatorLeaseRepository([
    {
      id: "lease-1",
      allocatorId: "allocator-a",
      shardId: "runtime-shard-1",
      leaseOwner: "owner-a",
      leaseExpiresAt: "2026-05-07T12:00:10.000Z",
      lastHeartbeatAt: "2026-05-07T12:00:00.000Z",
      status: "active",
      createdAt: "2026-05-07T12:00:00.000Z",
      updatedAt: "2026-05-07T12:00:00.000Z",
    },
  ]);
  const leaseService = createAllocatorLeaseService(leases);
  const health = createAllocatorHealthService(leaseService);

  const summary = await health.getHealth({
    now: "2026-05-07T12:01:00.000Z",
    shardCount: 2,
  });

  assert.equal(summary.status, "degraded");
  assert.equal(summary.failoverState, "recovering");
  assert.deepEqual(summary.recoverableShardIds, ["runtime-shard-1"]);
  assert.equal(summary.shardCoverage.unownedShards, 2);
});
