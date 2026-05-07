import assert from "node:assert/strict";
import test from "node:test";

import { WORKER_EXECUTION_OUTCOMES } from "../modules/runtime/index.ts";
import { createWorkerHandlerRegistry } from "../modules/runtime/server/worker-handler-registry.ts";
import { createWorkerRunnerService } from "../modules/runtime/server/worker-runner-service.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("worker runner executes registered handlers, supports heartbeats, and completes jobs", async () => {
  const harness = createRuntimeHarness();
  const queued = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    now: "2026-05-06T18:00:00.000Z",
    type: "test.success",
    payload: { workItemId: "item-1" },
    payloadVersion: "v1",
    idempotencyKey: "test.success:item-1",
    correlationId: "corr-success-1",
    causationId: "cause-success-1",
    sourceEventId: "event-success-1",
  });
  assert.equal(queued.ok, true);

  let leaseExtended = false;
  const runner = createWorkerRunnerService(
    harness.runtime,
    createWorkerHandlerRegistry([
      {
        type: "test.success",
        description: "Completes test work.",
        async handle(context) {
          assert.equal(context.organizationId, "org-1");
          assert.equal(context.correlationId, "corr-success-1");
          assert.equal(context.causationId, "cause-success-1");
          assert.equal(context.sourceEventId, "event-success-1");
          const extended = await context.heartbeat.extendLease({
            now: "2026-05-06T18:00:10.000Z",
            leaseDurationMs: 90_000,
          });
          leaseExtended = true;
          assert.equal(extended.leaseExpiresAt, "2026-05-06T18:01:40.000Z");
          return {
            success: true,
            message: `processed:${String(context.payload.workItemId)}`,
          };
        },
      },
    ]),
  );

  const result = await runner.processPending({
    organizationId: "org-1",
    services: {},
    workerId: "worker-success",
    now: "2026-05-06T18:00:05.000Z",
    leaseDurationMs: 30_000,
  });

  assert.equal(result.ok, true);
  assert.equal(leaseExtended, true);
  assert.equal(result.value.processedCount, 1);
  assert.equal(result.value.completedCount, 1);
  assert.equal(result.value.executions[0]?.outcome, WORKER_EXECUTION_OUTCOMES.Succeeded);
  assert.equal(result.value.executions[0]?.message, "processed:item-1");
  assert.equal(harness.jobs[0]?.status, "succeeded");
});

test("worker runner safely retries unknown handlers, reclaims expired leases, and dead-letters exhausted jobs", async () => {
  const harness = createRuntimeHarness();
  const queued = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    now: "2026-05-06T19:00:00.000Z",
    type: "test.unknown",
    payload: { workItemId: "item-2" },
    payloadVersion: "v1",
    idempotencyKey: "test.unknown:item-2",
    correlationId: "corr-unknown-1",
    causationId: "cause-unknown-1",
    maxAttempts: 2,
  });
  assert.equal(queued.ok, true);

  const firstClaim = await harness.runtime.lease.claimNext({
    organizationId: "org-1",
    workerId: "stale-worker",
    leaseDurationMs: 30_000,
    now: "2026-05-06T19:00:05.000Z",
  });
  assert.equal(firstClaim.ok, true);

  const runner = createWorkerRunnerService(harness.runtime, createWorkerHandlerRegistry());
  const firstAttempt = await runner.processPending({
    organizationId: "org-1",
    services: {},
    workerId: "worker-reclaimer",
    now: "2026-05-06T19:01:00.000Z",
    leaseDurationMs: 30_000,
  });
  assert.equal(firstAttempt.ok, true);
  assert.equal(firstAttempt.value.processedCount, 1);
  assert.equal(firstAttempt.value.executions[0]?.outcome, WORKER_EXECUTION_OUTCOMES.DeadLettered);
  assert.equal(harness.jobs[0]?.status, "dead_lettered");
  assert.equal(harness.jobs[0]?.attemptCount, 2);
  assert.equal(harness.jobs[0]?.status, "dead_lettered");
  assert.equal(harness.deadLetters.length, 1);
});

test("duplicate runners remain safe under lease claiming", async () => {
  const harness = createRuntimeHarness();
  const queued = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    now: "2026-05-06T20:00:00.000Z",
    type: "test.single-owner",
    payload: { workItemId: "item-3" },
    payloadVersion: "v1",
    idempotencyKey: "test.single-owner:item-3",
    correlationId: "corr-single-owner-1",
    causationId: "cause-single-owner-1",
  });
  assert.equal(queued.ok, true);

  const runner = createWorkerRunnerService(
    harness.runtime,
    createWorkerHandlerRegistry([
      {
        type: "test.single-owner",
        description: "Completes single-owner work.",
        async handle() {
          return { success: true };
        },
      },
    ]),
  );

  const [first, second] = await Promise.all([
    runner.processPending({
      organizationId: "org-1",
      services: {},
      workerId: "worker-a",
      now: "2026-05-06T20:00:05.000Z",
    }),
    runner.processPending({
      organizationId: "org-1",
      services: {},
      workerId: "worker-b",
      now: "2026-05-06T20:00:05.000Z",
    }),
  ]);

  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.value.processedCount + second.value.processedCount, 1);
  assert.equal(harness.jobs[0]?.status, "succeeded");
});
