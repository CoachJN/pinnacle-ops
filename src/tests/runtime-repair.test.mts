import assert from "node:assert/strict";
import test from "node:test";

import { RUNTIME_REPAIR_ACTION_TYPES } from "@/modules/operations/domain/runtime-repair-action.ts";
import { createInMemoryRuntimeObservabilityRepositories } from "@/modules/operations/server/runtime-observability-repository.ts";
import { createRuntimeOperationsPlatform } from "@/modules/operations/server/runtime-operations-factory.ts";
import { createInMemorySchedulerRepositories } from "@/modules/scheduler/server/scheduler-task-repository.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("high-risk runtime repair actions require confirmation and remain idempotent after approval", async () => {
  const harness = createRuntimeHarness();
  const observabilityRepositories = createInMemoryRuntimeObservabilityRepositories();
  const schedulerRepositories = createInMemorySchedulerRepositories();

  const queued = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "manager-1", role: "manager" },
    now: "2026-05-06T13:00:00.000Z",
    type: "repair.target",
    payload: { unit: "repair" },
    payloadVersion: "v1",
    idempotencyKey: "repair.target:1",
    correlationId: "corr-repair-1",
    causationId: "cause-repair-1",
    sourceEventId: "event-repair-1",
    maxAttempts: 1,
  });
  assert.equal(queued.ok, true);

  const claimed = await harness.runtime.lease.claimNext({
    organizationId: "org-1",
    workerId: "worker-repair-1",
    leaseDurationMs: 30_000,
    now: "2026-05-06T13:00:05.000Z",
  });
  assert.equal(claimed.ok, true);

  const failed = await harness.runtime.jobs.fail({
    organizationId: "org-1",
    jobId: claimed.value?.id ?? "",
    workerId: "worker-repair-1",
    claimToken: claimed.value?.lease.claimToken ?? "",
    now: "2026-05-06T13:00:10.000Z",
    error: {
      code: "fatal",
      message: "repair me",
      retryable: true,
      occurredAt: "2026-05-06T13:00:10.000Z",
      details: {},
    },
  });
  assert.equal(failed.ok, true);
  assert.equal(harness.deadLetters.length, 1);

  const operations = createRuntimeOperationsPlatform(
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
    schedulerRepositories,
  );

  const first = await operations.repair.execute({
    organizationId: "org-1",
    actor: { userId: "owner-1", role: "owner" },
    actionType: RUNTIME_REPAIR_ACTION_TYPES.DeadLetterReplay,
    targetId: harness.deadLetters[0]?.id ?? "",
    idempotencyKey: "repair-action:dead-letter:1",
    reason: "Replay the exhausted dead-letter job after validation.",
    now: "2026-05-06T13:01:00.000Z",
  });
  assert.equal(first.ok, true);
  assert.equal(first.value.status, "pending_confirmation");
  assert.equal(harness.jobs.length, 1);

  const confirmationId = String(first.value.metadata.confirmationId ?? "");
  assert.equal(confirmationId.length > 0, true);

  const approved = await operations.repair.confirm({
    organizationId: "org-1",
    actor: { userId: "owner-1", role: "owner" },
    confirmationId,
    reason: "Approved after operator review.",
    now: "2026-05-06T13:01:30.000Z",
  });
  assert.equal(approved.ok, true);
  assert.equal(approved.value.status, "completed");
  assert.equal(harness.jobs.length, 2);

  const second = await operations.repair.execute({
    organizationId: "org-1",
    actor: { userId: "owner-1", role: "owner" },
    actionType: RUNTIME_REPAIR_ACTION_TYPES.DeadLetterReplay,
    targetId: harness.deadLetters[0]?.id ?? "",
    idempotencyKey: "repair-action:dead-letter:1",
    now: "2026-05-06T13:02:00.000Z",
  });
  assert.equal(second.ok, true);
  assert.equal(second.value.id, first.value.id);
  assert.equal(harness.jobs.length, 2);

  const repairHistory = await observabilityRepositories.repairActions.listByOrganizationId({
    organizationId: "org-1",
  });
  assert.equal(repairHistory.length, 1);

  const pendingConfirmations = await schedulerRepositories.confirmations.listPendingByOrganizationId({
    organizationId: "org-1",
  });
  assert.equal(pendingConfirmations.length, 0);
});
