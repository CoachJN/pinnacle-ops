import assert from "node:assert/strict";
import test from "node:test";

import { createAllocatorLeaseService } from "@/modules/runtime-allocator";
import { createInMemoryAllocatorLeaseRepository } from "@/tests/support/runtime-allocator-test-utils.ts";

test("allocator leases prevent duplicate shard ownership and recover after expiry", async () => {
  const repository = createInMemoryAllocatorLeaseRepository();
  const leases = createAllocatorLeaseService(repository);

  const first = await leases.claimShard({
    allocatorId: "allocator-a",
    shardId: "runtime-shard-1",
    leaseOwner: "owner-a",
    now: "2026-05-07T12:00:00.000Z",
  });
  const duplicate = await leases.claimShard({
    allocatorId: "allocator-b",
    shardId: "runtime-shard-1",
    leaseOwner: "owner-b",
    now: "2026-05-07T12:00:30.000Z",
  });
  const recovered = await leases.claimShard({
    allocatorId: "allocator-b",
    shardId: "runtime-shard-1",
    leaseOwner: "owner-b",
    now: "2026-05-07T12:01:30.000Z",
  });

  assert.equal(first.acquired, true);
  assert.equal(duplicate.acquired, false);
  assert.equal(recovered.acquired, true);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.lease.allocatorId, "allocator-b");
});
