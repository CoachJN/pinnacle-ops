import assert from "node:assert/strict";
import test from "node:test";

import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("worker lease claims are single-owner and expired leases are safely reclaimable", async () => {
  const harness = createRuntimeHarness();

  const queued = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    now: "2026-05-06T13:00:00.000Z",
    type: "sla.timer",
    payload: { timerId: "timer-1" },
    payloadVersion: "v1",
    idempotencyKey: "sla.timer:timer-1",
    correlationId: "corr-lease-1",
    causationId: "cause-lease-1",
  });
  assert.equal(queued.ok, true);

  const firstClaim = await harness.runtime.lease.claimNext({
    organizationId: "org-1",
    workerId: "worker-a",
    leaseDurationMs: 30_000,
    now: "2026-05-06T13:00:05.000Z",
  });
  assert.equal(firstClaim.ok, true);
  assert.equal(firstClaim.value?.leasedBy, "worker-a");
  assert.equal(firstClaim.value?.attemptCount, 1);

  const duplicateClaim = await harness.runtime.lease.claimNext({
    organizationId: "org-1",
    workerId: "worker-b",
    leaseDurationMs: 30_000,
    now: "2026-05-06T13:00:10.000Z",
  });
  assert.equal(duplicateClaim.ok, true);
  assert.equal(duplicateClaim.value, null);

  const running = await harness.runtime.lease.markRunning({
    organizationId: "org-1",
    jobId: firstClaim.value?.id ?? "",
    workerId: "worker-a",
    now: "2026-05-06T13:00:15.000Z",
  });
  assert.equal(running.ok, true);

  const reclaimed = await harness.runtime.lease.claimNext({
    organizationId: "org-1",
    workerId: "worker-b",
    leaseDurationMs: 45_000,
    now: "2026-05-06T13:01:00.000Z",
  });
  assert.equal(reclaimed.ok, true);
  assert.equal(reclaimed.value?.leasedBy, "worker-b");
  assert.equal(reclaimed.value?.attemptCount, 2);

  const extended = await harness.runtime.lease.extendLease({
    organizationId: "org-1",
    jobId: reclaimed.value?.id ?? "",
    workerId: "worker-b",
    now: "2026-05-06T13:01:10.000Z",
    leaseDurationMs: 60_000,
  });
  assert.equal(extended.ok, true);
  assert.equal(extended.ok && extended.value.leaseExpiresAt, "2026-05-06T13:02:10.000Z");
});
