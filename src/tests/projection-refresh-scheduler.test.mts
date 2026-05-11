import assert from "node:assert/strict";
import test from "node:test";

import { createInMemoryRuntimeObservabilityRepositories } from "@/modules/operations/server/runtime-observability-repository.ts";
import { createProjectionRefreshHandler } from "@/modules/scheduler/server/handlers/projection-refresh-handler.ts";
import { createWorkerHandlerRegistry } from "@/modules/runtime/server/worker-handler-registry.ts";
import { createWorkerRunnerService } from "@/modules/runtime/server/worker-runner-service.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("projection refresh scheduled jobs execute through the worker runtime and persist projections", async () => {
  const harness = createRuntimeHarness();
  const observabilityRepositories = createInMemoryRuntimeObservabilityRepositories();
  const queued = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "system", role: "system" },
    now: "2026-05-07T11:00:00.000Z",
    type: "operations.projection.refresh",
    payloadVersion: "v1",
    payload: {
      payloadVersion: "v1",
      scheduledTaskId: "runtime-scheduled-task:org-1:operations.projection.refresh",
      scheduledFor: "2026-05-07T11:00:00.000Z",
      batchLimit: 1,
      taskType: "operations.projection.refresh",
    },
    idempotencyKey: "scheduled:projection:1",
    correlationId: "scheduler:org-1:operations.projection.refresh",
    causationId: "scheduler:projection",
    sourceEventId: null,
  });
  assert.equal(queued.ok, true);

  const runner = createWorkerRunnerService(
    harness.runtime,
    createWorkerHandlerRegistry([
      createProjectionRefreshHandler(
        {
          domainEvents: harness.repositories.domainEvents,
          runtimeJobs: harness.repositories.runtimeJobs,
          runtimeDeadLetters: harness.repositories.runtimeDeadLetters,
          runtimeEventProcessings: harness.repositories.runtimeEventProcessings,
          deliveryPlans: harness.repositories.deliveryPlans,
          deliveryAttempts: harness.repositories.deliveryAttempts,
          escalationOrchestrations: harness.repositories.escalationOrchestrations,
          slaTimers: harness.repositories.slaTimers,
        },
        {
          runtime: harness.runtime,
          providerRuntime: harness.providerRuntime,
          delivery: harness.delivery,
        },
        observabilityRepositories,
      ),
    ]),
  );

  const result = await runner.processPending({
    organizationId: "org-1",
    services: harness as never,
    workerId: "projection-worker-1",
    now: "2026-05-07T11:00:05.000Z",
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.completedCount, 1);

  const projection = await observabilityRepositories.projections.getByOrganizationId("org-1");
  assert.ok(projection);
  assert.equal(projection?.organizationId, "org-1");
});
