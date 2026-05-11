import assert from "node:assert/strict";
import test from "node:test";

import {
  createInMemoryRuntimeLoopRepositories,
  createRuntimeDrainService,
  createRuntimeLoopCoordinator,
  createRuntimeLoopHeartbeatService,
  createRuntimeLoopService,
  RUNTIME_LOOP_TYPES,
} from "@/modules/runtime-loops/index.ts";

test("drain requests allow the active cycle to finish and prevent the next cycle from starting new work", async () => {
  const repositories = createInMemoryRuntimeLoopRepositories();
  const loopService = createRuntimeLoopService(repositories.loops);
  const heartbeat = createRuntimeLoopHeartbeatService(
    repositories.loops,
    loopService,
    repositories.events,
  );
  const drain = createRuntimeDrainService(
    repositories.state,
    repositories.events,
    repositories.loops,
  );
  const coordinator = createRuntimeLoopCoordinator(
    loopService,
    heartbeat,
    drain,
    repositories.results,
    repositories.loops,
  );

  const first = await coordinator.runCycle({
    organizationId: "org-1",
    loopType: RUNTIME_LOOP_TYPES.WorkerDaemon,
    leaseOwner: "worker-owner-a",
    now: "2026-05-07T13:00:00.000Z",
    cadence: 15_000,
    concurrencyLimit: 2,
    leaseDurationMs: 60_000,
    execute: async () => {
      await drain.requestDrain({
        organizationId: "org-1",
        loopTypes: [RUNTIME_LOOP_TYPES.WorkerDaemon],
        now: "2026-05-07T13:00:01.000Z",
        drainWindowMs: 120_000,
      });
      return {
        status: "succeeded",
        processedCount: 2,
        message: "completed in-flight batch",
      };
    },
  });

  const second = await coordinator.runCycle({
    organizationId: "org-1",
    loopType: RUNTIME_LOOP_TYPES.WorkerDaemon,
    leaseOwner: "worker-owner-a",
    now: "2026-05-07T13:00:05.000Z",
    cadence: 15_000,
    concurrencyLimit: 2,
    leaseDurationMs: 60_000,
    execute: async () => ({
      status: "succeeded",
      processedCount: 99,
      message: "should not run",
    }),
  });

  assert.equal(first.result.processedCount, 2);
  assert.equal(second.loopStatus, "draining");
  assert.equal(second.result.processedCount, 0);
});
