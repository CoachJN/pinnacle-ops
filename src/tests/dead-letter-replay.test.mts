import assert from "node:assert/strict";
import test from "node:test";

import { createDeadLetterReplayService } from "../modules/runtime/server/dead-letter-replay-service.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("dead-letter replay preserves canonical identifiers and requires force for non-retryable jobs", async () => {
  const harness = createRuntimeHarness();
  const queued = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    now: "2026-05-06T21:00:00.000Z",
    type: "test.dead-letter",
    payload: { workItemId: "item-4" },
    payloadVersion: "v1",
    idempotencyKey: "test.dead-letter:item-4",
    correlationId: "corr-dead-letter-1",
    causationId: "cause-dead-letter-1",
    sourceEventId: "event-dead-letter-1",
    maxAttempts: 1,
  });
  assert.equal(queued.ok, true);

  const claimed = await harness.runtime.lease.claimNext({
    organizationId: "org-1",
    workerId: "worker-a",
    leaseDurationMs: 30_000,
    now: "2026-05-06T21:00:05.000Z",
  });
  assert.equal(claimed.ok, true);

  const failed = await harness.runtime.jobs.fail({
    organizationId: "org-1",
    jobId: claimed.value?.id ?? "",
    workerId: "worker-a",
    claimToken: claimed.value?.lease.claimToken ?? "",
    now: "2026-05-06T21:00:10.000Z",
    error: {
      code: "not_retryable",
      message: "permanent failure",
      retryable: false,
      occurredAt: "2026-05-06T21:00:10.000Z",
      details: {},
    },
  });
  assert.equal(failed.ok, true);
  assert.equal(harness.deadLetters.length, 1);

  const replay = createDeadLetterReplayService(
    {
      runtimeDeadLetters: createRepositoryHarness(harness).runtimeDeadLetters as never,
      runtimeJobs: createRepositoryHarness(harness).runtimeJobs as never,
    },
    harness.runtime.jobs,
  );

  const blocked = await replay.replay({
    organizationId: "org-1",
    deadLetterId: harness.deadLetters[0]?.id ?? "",
    actor: { userId: "owner-1", role: "owner" },
  });
  assert.equal(blocked.ok, false);

  const forced = await replay.replay({
    organizationId: "org-1",
    deadLetterId: harness.deadLetters[0]?.id ?? "",
    actor: { userId: "owner-1", role: "owner" },
    force: true,
    now: "2026-05-06T21:01:00.000Z",
  });
  assert.equal(forced.ok, true);
  assert.equal(forced.value.id === harness.deadLetters[0]?.originalJobId, false);
  assert.equal(forced.value.correlationId, "corr-dead-letter-1");
  assert.equal(forced.value.sourceEventId, "event-dead-letter-1");
  assert.deepEqual(forced.value.payload.replayOf, {
    deadLetterId: harness.deadLetters[0]?.id,
    originalJobId: harness.deadLetters[0]?.originalJobId,
    replayedAt: "2026-05-06T21:01:00.000Z",
  });
  assert.equal(harness.deadLetters.length, 1);
});

function createRepositoryHarness(harness: ReturnType<typeof createRuntimeHarness>) {
  return {
    runtimeJobs: {
      async getById(id: string) {
        return harness.jobs.find((item) => item.id === id) ?? null;
      },
    },
    runtimeDeadLetters: {
      async getById(id: string) {
        return harness.deadLetters.find((item) => item.id === id) ?? null;
      },
    },
  };
}
