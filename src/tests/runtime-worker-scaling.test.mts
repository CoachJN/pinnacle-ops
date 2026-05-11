import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeWorkerScalingService } from "@/modules/runtime-claim";

test("worker scaling remains bounded and observable under pressure", () => {
  const scaling = createRuntimeWorkerScalingService();
  const snapshot = scaling.recommend({
    now: "2026-05-07T12:05:00.000Z",
    activeWorkers: 1,
    policy: {
      minWorkers: 1,
      maxWorkers: 3,
      maxClaimsPerWorker: 2,
    },
    balancing: {
      orderedDecisions: [
        {
          tenantId: "tenant-a",
          organizationId: "tenant-a",
          fairnessWeight: 1,
          allocatorWindowId: "w1",
          shardId: "runtime-shard-1",
          pressureState: "normal",
          quotaHeadroom: 4,
          replayPressure: 0,
          providerPressure: "normal",
          claimDecisionReason: null,
          grantedClaims: 3,
          effectiveWeight: 1,
          oldestQueueWaitMs: 1_000,
          starvationPrevented: false,
        },
        {
          tenantId: "tenant-b",
          organizationId: "tenant-b",
          fairnessWeight: 1,
          allocatorWindowId: "w2",
          shardId: "runtime-shard-1",
          pressureState: "degraded",
          quotaHeadroom: 2,
          replayPressure: 1,
          providerPressure: "isolated",
          claimDecisionReason: "provider isolated",
          grantedClaims: 2,
          effectiveWeight: 0.5,
          oldestQueueWaitMs: 2_000,
          starvationPrevented: true,
        },
      ],
      replayPressureTenants: 1,
      providerIsolatedTenants: 1,
      starvationProtectedTenants: 1,
    },
  });

  assert.equal(snapshot.boundedWorkers, 1);
  assert.equal(snapshot.totalGrantedClaims, 5);
  assert.ok(snapshot.reasoning.length > 0);
});
