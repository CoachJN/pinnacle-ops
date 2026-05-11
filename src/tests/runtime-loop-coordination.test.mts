import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeSchedulerService } from "@/modules/scheduler/server/runtime-scheduler-service.ts";
import { createInMemorySchedulerRepositories } from "@/modules/scheduler/server/scheduler-task-repository.ts";
import {
  createInMemoryRuntimeLoopRepositories,
  createRuntimeDrainService,
  createRuntimeLoopCoordinator,
  createRuntimeLoopHeartbeatService,
  createRuntimeLoopService,
} from "@/modules/runtime-loops/index.ts";
import { createRuntimeHarness } from "@/tests/support/runtime-harness.ts";
import { createSchedulerLoopRunner } from "@/modules/runtime-loops/server/scheduler-loop-runner.ts";

test("duplicate scheduler loops do not double-enqueue runtime work and bounded cadence stays finite", async () => {
  const harness = createRuntimeHarness();
  const schedulerRepositories = createInMemorySchedulerRepositories();
  const scheduler = createRuntimeSchedulerService(
    schedulerRepositories,
    harness.runtime,
  );
  const loopRepositories = createInMemoryRuntimeLoopRepositories();
  const loopService = createRuntimeLoopService(loopRepositories.loops);
  const heartbeat = createRuntimeLoopHeartbeatService(
    loopRepositories.loops,
    loopService,
    loopRepositories.events,
  );
  const drain = createRuntimeDrainService(
    loopRepositories.state,
    loopRepositories.events,
    loopRepositories.loops,
  );
  const coordinator = createRuntimeLoopCoordinator(
    loopService,
    heartbeat,
    drain,
    loopRepositories.results,
    loopRepositories.loops,
  );
  const runner = createSchedulerLoopRunner(coordinator, scheduler);

  const first = await runner.runCycle({
    organizationId: "org-1",
    leaseOwner: "scheduler-owner-a",
    now: "2026-05-07T10:00:00.000Z",
    cadence: 60_000,
    concurrencyLimit: 1,
    leaseDurationMs: 60_000,
  });
  const duplicate = await runner.runCycle({
    organizationId: "org-1",
    leaseOwner: "scheduler-owner-b",
    now: "2026-05-07T10:00:00.000Z",
    cadence: 60_000,
    concurrencyLimit: 1,
    leaseDurationMs: 60_000,
  });

  assert.equal(first.acquired, true);
  assert.equal(first.result.enqueuedCount, 4);
  assert.equal(duplicate.acquired, false);
  assert.equal(duplicate.loopStatus, "duplicate_owner");
  assert.equal(harness.jobs.length, 4);

  let iterations = 0;
  let sleeps = 0;
  await coordinator.runBoundedLoop({
    iterations: 3,
    cadenceMs: 25,
    runCycle: async () => {
      iterations += 1;
    },
    sleep: async () => {
      sleeps += 1;
    },
  });
  assert.equal(iterations, 3);
  assert.equal(sleeps, 2);
});
