import assert from "node:assert/strict";
import test from "node:test";

import { RUNTIME_REPAIR_ACTION_TYPES } from "@/modules/operations/domain/runtime-repair-action.ts";
import { createInMemoryRuntimeObservabilityRepositories } from "@/modules/operations/server/runtime-observability-repository.ts";
import { createRuntimeOperationsPlatform } from "@/modules/operations/server/runtime-operations-factory.ts";
import { createInMemorySchedulerRepositories } from "@/modules/scheduler/server/scheduler-task-repository.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("repair guardrails enforce reasons and support dry-run without runtime mutation", async () => {
  const harness = createRuntimeHarness();
  const observabilityRepositories = createInMemoryRuntimeObservabilityRepositories();
  const schedulerRepositories = createInMemorySchedulerRepositories();

  const missingReason = await createRuntimeOperationsPlatform(
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
  ).repair.execute({
    organizationId: "org-1",
    actor: { userId: "owner-1", role: "owner" },
    actionType: RUNTIME_REPAIR_ACTION_TYPES.ProviderReconciliationRetry,
    targetId: "receipt-1",
    now: "2026-05-07T13:00:00.000Z",
  });
  assert.equal(missingReason.ok, false);

  const dryRun = await createRuntimeOperationsPlatform(
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
  ).repair.execute({
    organizationId: "org-1",
    actor: { userId: "owner-1", role: "owner" },
    actionType: RUNTIME_REPAIR_ACTION_TYPES.DeadLetterReplay,
    targetId: "dead-letter-1",
    reason: "Validate the guardrail path.",
    dryRun: true,
    now: "2026-05-07T13:01:00.000Z",
  });
  assert.equal(dryRun.ok, true);
  assert.equal(dryRun.value.status, "noop");
  assert.equal(harness.jobs.length, 0);
});
