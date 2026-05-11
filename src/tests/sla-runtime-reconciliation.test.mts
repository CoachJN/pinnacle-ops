import assert from "node:assert/strict";
import test from "node:test";

import { createSlaRuntimeOperatorService } from "../modules/sla/server/sla-runtime-operator-service.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("reconciliation attaches the active evaluation job when the timer references a stale job", async () => {
  const harness = createRuntimeHarness();
  harness.slaTimers.push(
    makeTimer({
      id: "sla-stale-1",
      organizationId: "org-1",
      targetEntityId: "wo-stale-1",
      runtimeJobId: "job-old-1",
    }),
  );
  harness.jobs.push(
    makeJob({
      id: "job-old-1",
      organizationId: "org-1",
      timerId: "sla-stale-1",
      status: "succeeded",
      idempotencyKey: "old-key",
    }),
    makeJob({
      id: "job-active-1",
      organizationId: "org-1",
      timerId: "sla-stale-1",
      status: "queued",
      idempotencyKey: "active-key",
    }),
  );

  const operator = createSlaRuntimeOperatorService({
    repositories: harness.repositories,
    services: {
      runtime: harness.runtime,
      sla: harness.sla,
    } as never,
  });

  const result = await operator.reconcileTimers({
    organizationId: "org-1",
    dueBefore: "2026-05-06T13:00:00.000Z",
    limit: 10,
    now: "2026-05-06T13:00:00.000Z",
    audit: systemAudit("org-1", "2026-05-06T13:00:00.000Z"),
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.staleJobReferenceCount, 1);
  assert.equal(result.value.enqueueRepairCount, 0);
  assert.equal(harness.slaTimers[0]?.runtimeJobId, "job-active-1");
  assert.equal(harness.jobs.length, 2);
});

test("reconciliation repairs orphaned or terminal timers by enqueuing one canonical evaluation job", async () => {
  const harness = createRuntimeHarness();
  harness.slaTimers.push(
    makeTimer({
      id: "sla-orphan-1",
      organizationId: "org-1",
      targetEntityId: "wo-orphan-1",
      runtimeJobId: "job-terminal-1",
    }),
  );
  harness.jobs.push(
    makeJob({
      id: "job-terminal-1",
      organizationId: "org-1",
      timerId: "sla-orphan-1",
      status: "dead_lettered",
      idempotencyKey: "terminal-key",
    }),
  );

  const operator = createSlaRuntimeOperatorService({
    repositories: harness.repositories,
    services: {
      runtime: harness.runtime,
      sla: harness.sla,
    } as never,
  });

  const result = await operator.reconcileTimers({
    organizationId: "org-1",
    dueBefore: "2026-05-06T13:00:00.000Z",
    limit: 10,
    now: "2026-05-06T13:00:00.000Z",
    audit: systemAudit("org-1", "2026-05-06T13:00:00.000Z"),
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.enqueueRepairCount, 1);
  assert.equal(harness.jobs.length, 2);
  assert.equal(harness.slaTimers[0]?.runtimeJobId, harness.jobs[1]?.id);
  assert.equal(
    harness.jobs[1]?.idempotencyKey,
    "sla.timer.evaluate:sla-orphan-1:repair:after:job-terminal-1",
  );
});

function makeTimer(input: {
  id: string;
  organizationId: string;
  targetEntityId: string;
  runtimeJobId: string | null;
}) {
  return {
    id: input.id,
    organizationId: input.organizationId,
    tenantId: input.organizationId,
    type: "work_order.first_response_due" as const,
    targetEntityType: "work_order" as const,
    targetEntityId: input.targetEntityId,
    status: "scheduled" as const,
    dueAt: "2026-05-06T12:00:00.000Z",
    policyVersion: "work_order.first_response_due.v1",
    payloadVersion: "v1",
    condition: {
      kind: "work_order_first_response" as const,
      workOrderId: input.targetEntityId,
      activationEventId: `event-${input.id}`,
      activationEventType: "work_order_created" as const,
      activationOccurredAt: "2026-05-06T11:00:00.000Z",
      initialLifecycleStatus: "new",
    },
    sourceEventId: `event-${input.id}`,
    correlationId: `corr-${input.id}`,
    causationId: `cause-${input.id}`,
    idempotencyKey: `timer:${input.id}`,
    runtimeJobId: input.runtimeJobId,
    evaluatedAt: null,
    satisfiedAt: null,
    breachedAt: null,
    cancelledAt: null,
    failureReason: null,
    createdAt: "2026-05-06T11:00:00.000Z",
    updatedAt: "2026-05-06T11:00:00.000Z",
  };
}

function makeJob(input: {
  id: string;
  organizationId: string;
  timerId: string;
  status: "queued" | "succeeded" | "dead_lettered";
  idempotencyKey: string;
}) {
  return {
    id: input.id,
    organizationId: input.organizationId,
    tenantId: input.organizationId,
    type: "sla.timer.evaluate",
    status: input.status,
    payload: {
      timerId: input.timerId,
      payloadVersion: "v1",
    },
    payloadVersion: "v1",
    idempotencyKey: input.idempotencyKey,
    correlationId: `corr-${input.id}`,
    causationId: `cause-${input.id}`,
    sourceEventId: `event-${input.id}`,
    attemptCount: 1,
    maxAttempts: 5,
    runAfter: "2026-05-06T12:00:00.000Z",
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
    createdAt: "2026-05-06T12:00:00.000Z",
    updatedAt: "2026-05-06T12:00:00.000Z",
    lastError: null,
    completedAt: input.status === "queued" ? null : "2026-05-06T12:01:00.000Z",
  };
}

function systemAudit(organizationId: string, now: string) {
  return {
    organizationId,
    actor: { userId: "system", role: "system" as const },
    now,
  };
}
