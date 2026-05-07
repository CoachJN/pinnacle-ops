import assert from "node:assert/strict";
import test from "node:test";

import { WORKER_EXECUTION_OUTCOMES } from "../modules/runtime/index.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("worker runtime enqueue is idempotent and completion is duplicate-safe", async () => {
  const harness = createRuntimeHarness();

  const queued = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    now: "2026-05-06T12:00:00.000Z",
    type: "provider.sync",
    payload: { connectionId: "conn-1" },
    payloadVersion: "v1",
    idempotencyKey: "provider.sync:conn-1:delta-1",
    correlationId: "corr-1",
    causationId: "cause-1",
    sourceEventId: "event-1",
  });
  assert.equal(queued.ok, true);

  const duplicate = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    now: "2026-05-06T12:01:00.000Z",
    type: "provider.sync",
    payload: { connectionId: "conn-1" },
    payloadVersion: "v1",
    idempotencyKey: "provider.sync:conn-1:delta-1",
    correlationId: "corr-1",
    causationId: "cause-1",
    sourceEventId: "event-1",
  });
  assert.equal(duplicate.ok, true);
  assert.equal(harness.jobs.length, 1);
  assert.equal(duplicate.ok && queued.ok && duplicate.value.id, queued.value.id);

  const rejected = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    now: "2026-05-06T12:02:00.000Z",
    type: "provider.sync",
    payload: { connectionId: "conn-2" },
    payloadVersion: "v2",
    idempotencyKey: "provider.sync:conn-1:delta-1",
    correlationId: "corr-1",
    causationId: "cause-1",
  });
  assert.equal(rejected.ok, false);

  const claimed = await harness.runtime.lease.claimNext({
    organizationId: "org-1",
    workerId: "worker-1",
    leaseDurationMs: 60_000,
    now: "2026-05-06T12:03:00.000Z",
  });
  assert.equal(claimed.ok, true);
  assert.equal(claimed.value?.status, "leased");

  const running = await harness.runtime.lease.markRunning({
    organizationId: "org-1",
    jobId: claimed.value?.id ?? "",
    workerId: "worker-1",
    now: "2026-05-06T12:03:10.000Z",
  });
  assert.equal(running.ok, true);
  assert.equal(running.ok && running.value.status, "running");

  const completed = await harness.runtime.jobs.complete({
    organizationId: "org-1",
    jobId: claimed.value?.id ?? "",
    workerId: "worker-1",
    now: "2026-05-06T12:03:20.000Z",
  });
  assert.equal(completed.ok, true);
  assert.equal(completed.ok && completed.value.outcome, WORKER_EXECUTION_OUTCOMES.Succeeded);

  const completedAgain = await harness.runtime.jobs.complete({
    organizationId: "org-1",
    jobId: claimed.value?.id ?? "",
    workerId: "worker-1",
    now: "2026-05-06T12:03:30.000Z",
  });
  assert.equal(completedAgain.ok, true);
  assert.equal(
    completedAgain.ok && completedAgain.value.outcome,
    WORKER_EXECUTION_OUTCOMES.NoopDuplicate,
  );
  assert.deepEqual(
    harness.events.map((event) => event.type),
    ["runtime_job_queued", "runtime_job_succeeded"],
  );
});
