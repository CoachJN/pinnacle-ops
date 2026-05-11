import assert from "node:assert/strict";
import test from "node:test";

import { WORKER_EXECUTION_OUTCOMES } from "@/modules/runtime/index.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("retry storms are suppressed into dead-letter when tenant runtime is under backpressure", async () => {
  const harness = createRuntimeHarness();
  for (let index = 0; index < 8; index += 1) {
    harness.jobs.push({
      id: `storm-${index + 1}`,
      organizationId: "org-1",
      tenantId: "org-1",
      type: "provider.replay",
      status: "queued",
      payload: {},
      payloadVersion: "v1",
      idempotencyKey: `storm-${index + 1}`,
      correlationId: `storm-${index + 1}`,
      causationId: `storm-${index + 1}`,
      sourceEventId: null,
      attemptCount: 1,
      maxAttempts: 5,
      runAfter: "2026-05-07T09:58:00.000Z",
      leasedBy: null,
      leaseExpiresAt: null,
      lease: {
        workerId: null,
        claimToken: null,
        leaseVersion: 0,
        claimedAt: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        reclaimedAt: null,
        reclaimedBy: null,
        reclaimCount: 0,
      },
      createdAt: "2026-05-07T09:58:00.000Z",
      updatedAt: "2026-05-07T09:59:00.000Z",
      lastError: {
        code: "timeout",
        message: "storm",
        retryable: true,
        occurredAt: "2026-05-07T09:59:00.000Z",
        details: {},
      },
      completedAt: null,
    });
  }

  const claimed = await harness.runtime.lease.claimNext({
    organizationId: "org-1",
    workerId: "worker-1",
    leaseDurationMs: 30_000,
    now: "2026-05-07T10:00:10.000Z",
  });
  assert.equal(claimed.ok, true);
  const failed = await harness.runtime.jobs.fail({
    organizationId: "org-1",
    jobId: claimed.value?.id ?? "",
    workerId: "worker-1",
    claimToken: claimed.value?.lease.claimToken ?? "",
    now: "2026-05-07T10:00:20.000Z",
    error: {
      code: "timeout",
      message: "provider timed out",
      retryable: true,
      occurredAt: "2026-05-07T10:00:20.000Z",
      details: {},
    },
  });
  assert.equal(failed.ok, true);
  assert.equal(failed.value.outcome, WORKER_EXECUTION_OUTCOMES.DeadLettered);
});
