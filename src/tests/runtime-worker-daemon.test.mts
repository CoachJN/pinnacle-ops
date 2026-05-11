import assert from "node:assert/strict";
import test from "node:test";

import type { DomainServices } from "@/server/services";
import { createWorkerRunnerService } from "@/modules/runtime/server/worker-runner-service.ts";
import { createWorkerHandlerRegistry } from "@/modules/runtime/server/worker-handler-registry.ts";
import { createWorkerDaemonRunner } from "@/modules/runtime-loops/server/worker-daemon-runner.ts";
import {
  createInMemoryRuntimeLoopRepositories,
  createRuntimeDrainService,
  createRuntimeLoopCoordinator,
  createRuntimeLoopHeartbeatService,
  createRuntimeLoopService,
} from "@/modules/runtime-loops/index.ts";
import { createRuntimeHarness } from "@/tests/support/runtime-harness.ts";

test("worker daemon loop processes canonical runtime jobs through the existing worker runner", async () => {
  const harness = createRuntimeHarness();
  const now = "2026-05-07T15:00:00.000Z";

  await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    tenantId: "org-1",
    actor: { userId: "system", role: "system" },
    now,
    type: "test.loop.job",
    payloadVersion: "v1",
    payload: { payloadVersion: "v1" },
    idempotencyKey: "test-loop-job-1",
    correlationId: "corr-1",
    causationId: "cause-1",
  });

  const registry = createWorkerHandlerRegistry<DomainServices>([
    {
      type: "test.loop.job",
      description: "Test runtime loop job.",
      async handle() {
        return {
          success: true,
          message: "processed",
          metadata: {},
        };
      },
    },
  ]);
  const workerRunner = createWorkerRunnerService(
    harness.runtime,
    registry,
  ) as ReturnType<typeof createWorkerRunnerService<DomainServices>>;
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
  const runner = createWorkerDaemonRunner(coordinator, workerRunner);

  const result = await runner.runCycle({
    organizationId: "org-1",
    leaseOwner: "worker-daemon-owner-a",
    now,
    cadence: 15_000,
    concurrencyLimit: 1,
    leaseDurationMs: 60_000,
    services: {} as DomainServices,
  });

  assert.equal(result.acquired, true);
  assert.equal(result.result.processedCount, 1);
  assert.equal(harness.jobs[0]?.status, "succeeded");
});
