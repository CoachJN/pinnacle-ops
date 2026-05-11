import assert from "node:assert/strict";
import test from "node:test";

import { createWorkerHandlerRegistry } from "@/modules/runtime/server/worker-handler-registry.ts";
import { createWorkerRunnerService } from "@/modules/runtime/server/worker-runner-service.ts";
import { createProviderIsolationService } from "@/modules/runtime-capacity/server/provider-isolation-service.ts";
import { createRuntimeBackpressureService } from "@/modules/runtime-capacity/server/runtime-backpressure-service.ts";
import { createRuntimeCapacityGuardrailService } from "@/modules/runtime-capacity/server/runtime-capacity-guardrail-service.ts";
import { createRuntimeQuotaService } from "@/modules/runtime-capacity/server/runtime-quota-service.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("tenant runtime quotas isolate queue depth and claim concurrency", async () => {
  const harness = createRuntimeHarness();
  const quota = createRuntimeQuotaService(
    {
      repositories: {
        runtimeJobs: harness.repositories.runtimeJobs,
        runtimeDeadLetters: harness.repositories.runtimeDeadLetters,
        deliveryAttempts: harness.repositories.deliveryAttempts,
        escalationOrchestrations: harness.repositories.escalationOrchestrations,
      },
      providerRuntimeStorage: harness.providerRuntime.storage,
    },
    {
      "org-1": {
        maxConcurrentRuntimeJobs: 1,
        maxClaimBatchSize: 3,
      },
    },
  );
  const providerIsolation = createProviderIsolationService(quota);
  const backpressure = createRuntimeBackpressureService(quota, providerIsolation);
  const guardrails = createRuntimeCapacityGuardrailService(quota, backpressure, providerIsolation);

  const baseInput = {
    organizationId: "org-1",
    actor: { userId: "system", role: "system" as const },
    payloadVersion: "v1",
    payload: { unit: "quota" },
    correlationId: "corr-capacity",
    causationId: "cause-capacity",
  };
  for (let index = 0; index < 200; index += 1) {
    const queued = await harness.runtime.jobs.enqueue({
      ...baseInput,
      now: `2026-05-07T10:00:${String(index % 60).padStart(2, "0")}.000Z`,
      type: "capacity.test",
      idempotencyKey: `capacity:${index + 1}`,
    });
    assert.equal(queued.ok, true);
  }
  const blocked = await harness.runtime.jobs.enqueue({
    ...baseInput,
    now: "2026-05-07T10:04:00.000Z",
    type: "capacity.test",
    idempotencyKey: "capacity:201",
  });
  assert.equal(blocked.ok, false);

  harness.jobs[0] = {
    ...harness.jobs[0]!,
    status: "running",
    leasedBy: "existing-worker",
    leaseExpiresAt: "2026-05-07T10:10:00.000Z",
    lease: {
      ...harness.jobs[0]!.lease,
      workerId: "existing-worker",
      claimToken: "storm-lease-1",
      leaseVersion: 1,
      claimedAt: "2026-05-07T10:00:00.000Z",
      leaseExpiresAt: "2026-05-07T10:10:00.000Z",
      heartbeatAt: "2026-05-07T10:00:00.000Z",
    },
  };

  const runner = createWorkerRunnerService(
    harness.runtime,
    createWorkerHandlerRegistry([
      {
        type: "capacity.test",
        description: "capacity test handler",
        async handle() {
          return { success: true };
        },
      },
    ]),
    guardrails,
  );
  const result = await runner.processPending({
    organizationId: "org-1",
    services: {} as never,
    workerId: "runtime-capacity-worker-1",
    now: "2026-05-07T10:01:00.000Z",
    maxJobs: 3,
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.processedCount, 0);
});
