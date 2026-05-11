import assert from "node:assert/strict";
import test from "node:test";

import {
  WORKER_EXECUTION_OUTCOMES,
  calculateWorkerRetrySchedule,
} from "../modules/runtime/index.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("worker runtime retries with deterministic backoff, sanitizes errors, and dead-letters exhausted jobs", async () => {
  const harness = createRuntimeHarness();

  const queued = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    now: "2026-05-06T14:00:00.000Z",
    type: "provider.replay",
    payload: { receiptId: "receipt-1" },
    payloadVersion: "v1",
    idempotencyKey: "provider.replay:receipt-1",
    correlationId: "corr-retry-1",
    causationId: "cause-retry-1",
    maxAttempts: 2,
  });
  assert.equal(queued.ok, true);

  const firstClaim = await harness.runtime.lease.claimNext({
    organizationId: "org-1",
    workerId: "worker-1",
    leaseDurationMs: 30_000,
    now: "2026-05-06T14:00:01.000Z",
  });
  assert.equal(firstClaim.ok, true);

  const firstFailure = await harness.runtime.jobs.fail({
    organizationId: "org-1",
    jobId: firstClaim.value?.id ?? "",
    workerId: "worker-1",
    claimToken: firstClaim.value?.lease.claimToken ?? "",
    now: "2026-05-06T14:00:05.000Z",
    error: {
      code: "timeout",
      message: "provider token abc123 expired",
      retryable: true,
      occurredAt: "2026-05-06T14:00:05.000Z",
      details: {
        providerToken: "abc123",
        responseSnippet: "gateway timeout",
      },
    },
  });
  assert.equal(firstFailure.ok, true);
  assert.equal(firstFailure.ok && firstFailure.value.outcome, WORKER_EXECUTION_OUTCOMES.RetryScheduled);
  const expectedRetry = calculateWorkerRetrySchedule({
    attemptCount: 1,
    now: "2026-05-06T14:00:05.000Z",
    stableKey: `${firstClaim.value?.id}:provider.replay:receipt-1`,
  });
  assert.equal(firstFailure.ok && firstFailure.value.job.runAfter, expectedRetry.nextRunAfter);
  assert.equal(firstFailure.ok && firstFailure.value.job.lastError?.details.providerToken, "[redacted]");

  const secondClaim = await harness.runtime.lease.claimNext({
    organizationId: "org-1",
    workerId: "worker-2",
    leaseDurationMs: 300_000,
    now: expectedRetry.nextRunAfter,
  });
  assert.equal(secondClaim.ok, true);
  assert.equal(secondClaim.value?.attemptCount, 2);

  const secondFailure = await harness.runtime.jobs.fail({
    organizationId: "org-1",
    jobId: secondClaim.value?.id ?? "",
    workerId: "worker-2",
    claimToken: secondClaim.value?.lease.claimToken ?? "",
    now: "2026-05-06T14:02:00.000Z",
    error: {
      code: "validation",
      message: "payload invalid",
      retryable: true,
      occurredAt: "2026-05-06T14:02:00.000Z",
      details: {
        authorization: "Bearer xyz",
      },
    },
  });
  assert.equal(secondFailure.ok, true);
  assert.equal(secondFailure.ok && secondFailure.value.outcome, WORKER_EXECUTION_OUTCOMES.DeadLettered);
  assert.equal(harness.deadLetters.length, 1);
  assert.equal(harness.deadLetters[0]?.finalAttemptCount, 2);

  const diagnostics = await harness.runtime.diagnostics.getSummary({
    organizationId: "org-1",
    limit: 10,
  });
  assert.equal(diagnostics.ok, true);
  assert.equal(diagnostics.ok && diagnostics.value.deadLetterCount, 1);
  assert.equal(diagnostics.ok && diagnostics.value.queuedCount, 0);
  assert.equal(diagnostics.ok && diagnostics.value.jobsByType[0]?.type, "provider.replay");
  assert.equal(diagnostics.ok && diagnostics.value.recentFailures[0]?.status, "dead_lettered");
});
