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

test("expired loop ownership recovers deterministically and emits a failover event", async () => {
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

  await coordinator.runCycle({
    organizationId: "org-1",
    loopType: RUNTIME_LOOP_TYPES.AllocatorExecution,
    leaseOwner: "allocator-owner-a",
    now: "2026-05-07T12:00:00.000Z",
    cadence: 60_000,
    concurrencyLimit: 1,
    leaseDurationMs: 60_000,
    execute: async () => ({ status: "noop", message: "first" }),
  });

  const duplicate = await coordinator.runCycle({
    organizationId: "org-1",
    loopType: RUNTIME_LOOP_TYPES.AllocatorExecution,
    leaseOwner: "allocator-owner-b",
    now: "2026-05-07T12:00:30.000Z",
    cadence: 60_000,
    concurrencyLimit: 1,
    leaseDurationMs: 60_000,
    execute: async () => ({ status: "noop", message: "duplicate" }),
  });
  assert.equal(duplicate.acquired, false);

  const recovered = await coordinator.runCycle({
    organizationId: "org-1",
    loopType: RUNTIME_LOOP_TYPES.AllocatorExecution,
    leaseOwner: "allocator-owner-b",
    now: "2026-05-07T12:01:01.000Z",
    cadence: 60_000,
    concurrencyLimit: 1,
    leaseDurationMs: 60_000,
    execute: async () => ({ status: "noop", message: "recovered" }),
  });

  assert.equal(recovered.acquired, true);
  const events = await repositories.events.listRecentEvents({
    organizationId: "org-1",
  });
  assert.equal(events[0]?.eventKind, "failover");
  assert.equal(events[0]?.previousLeaseOwner, "allocator-owner-a");
});
