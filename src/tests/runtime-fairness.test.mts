import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeFairnessService } from "@/modules/runtime-capacity/server/runtime-fairness-service.ts";
import { DEFAULT_TENANT_RUNTIME_QUOTA } from "@/modules/runtime-capacity/domain/tenant-runtime-quota.ts";

test("fairness planning prevents one tenant from monopolizing bounded capacity", () => {
  const fairness = createRuntimeFairnessService();
  const quota = (tenantId: string) => ({
    tenantId,
    source: "default" as const,
    ...DEFAULT_TENANT_RUNTIME_QUOTA,
  });

  const plan = fairness.planAllocations({
    totalCapacity: 4,
    tenants: [
      {
        tenantId: "tenant-a",
        queuedJobs: 100,
        activeJobs: 0,
        requestedClaims: 4,
        quota: quota("tenant-a"),
      },
      {
        tenantId: "tenant-b",
        queuedJobs: 5,
        activeJobs: 0,
        requestedClaims: 4,
        quota: quota("tenant-b"),
      },
      {
        tenantId: "tenant-c",
        queuedJobs: 1,
        activeJobs: 0,
        requestedClaims: 4,
        quota: quota("tenant-c"),
      },
    ],
  });

  assert.equal(plan.grantedCapacity, 4);
  assert.equal(plan.allocations.find((item) => item.tenantId === "tenant-a")?.grantedClaims, 2);
  assert.equal(plan.allocations.find((item) => item.tenantId === "tenant-b")?.grantedClaims, 1);
  assert.equal(plan.allocations.find((item) => item.tenantId === "tenant-c")?.grantedClaims, 1);
});
