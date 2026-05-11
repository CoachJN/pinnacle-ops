import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeAllocatorService } from "@/modules/runtime-allocator";
import {
  createInMemoryAllocatorGlobalRepository,
  createWorkerJob,
} from "@/tests/support/runtime-allocator-test-utils.ts";

test("starvation prevention boosts long-waiting tenants ahead of fresh backlog", async () => {
  const jobs = [
    createWorkerJob({ id: "large-1", organizationId: "tenant-large", runAfter: "2026-05-07T12:04:30.000Z" }),
    createWorkerJob({ id: "large-2", organizationId: "tenant-large", runAfter: "2026-05-07T12:04:31.000Z" }),
    createWorkerJob({ id: "large-3", organizationId: "tenant-large", runAfter: "2026-05-07T12:04:32.000Z" }),
    createWorkerJob({ id: "small-1", organizationId: "tenant-small", runAfter: "2026-05-07T11:54:00.000Z" }),
  ];

  const allocator = createRuntimeAllocatorService(createInMemoryAllocatorGlobalRepository(jobs));
  const plan = await allocator.inspect({
    now: "2026-05-07T12:05:00.000Z",
    shardCount: 1,
    totalCapacity: 1,
  });

  const decision = plan.shardPlans[0]?.decisions.find((item) => item.grantedClaims === 1);
  assert.equal(decision?.tenantId, "tenant-small");
  assert.equal(decision?.starvationPrevented, true);
});
