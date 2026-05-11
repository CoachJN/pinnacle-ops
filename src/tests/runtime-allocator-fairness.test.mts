import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeAllocatorService } from "@/modules/runtime-allocator";
import {
  createInMemoryAllocatorGlobalRepository,
  createWorkerJob,
} from "@/tests/support/runtime-allocator-test-utils.ts";

test("shared allocator enforces deterministic weighted fairness across tenants", async () => {
  const jobs = [
    createWorkerJob({ id: "a-1", organizationId: "tenant-a", runAfter: "2026-05-07T12:00:00.000Z" }),
    createWorkerJob({ id: "a-2", organizationId: "tenant-a", runAfter: "2026-05-07T12:00:01.000Z" }),
    createWorkerJob({ id: "a-3", organizationId: "tenant-a", runAfter: "2026-05-07T12:00:02.000Z" }),
    createWorkerJob({ id: "a-4", organizationId: "tenant-a", runAfter: "2026-05-07T12:00:03.000Z" }),
    createWorkerJob({ id: "b-1", organizationId: "tenant-b", runAfter: "2026-05-07T12:00:00.000Z" }),
    createWorkerJob({ id: "b-2", organizationId: "tenant-b", runAfter: "2026-05-07T12:00:01.000Z" }),
    createWorkerJob({ id: "c-1", organizationId: "tenant-c", runAfter: "2026-05-07T12:00:00.000Z" }),
  ];

  const allocator = createRuntimeAllocatorService(createInMemoryAllocatorGlobalRepository(jobs));
  const plan = await allocator.inspect({
    now: "2026-05-07T12:05:00.000Z",
    shardCount: 1,
    totalCapacity: 4,
    quotaOverrides: {
      "tenant-a": { fairnessWeight: 2 },
      "tenant-b": { fairnessWeight: 1 },
      "tenant-c": { fairnessWeight: 1 },
    },
  });

  const decisions = plan.shardPlans[0]?.decisions ?? [];
  assert.equal(plan.grantedCapacity, 4);
  assert.equal(decisions.find((item) => item.tenantId === "tenant-a")?.grantedClaims, 2);
  assert.equal(decisions.find((item) => item.tenantId === "tenant-b")?.grantedClaims, 1);
  assert.equal(decisions.find((item) => item.tenantId === "tenant-c")?.grantedClaims, 1);
});
