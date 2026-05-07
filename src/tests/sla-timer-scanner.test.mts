import assert from "node:assert/strict";
import test from "node:test";

import { createSlaRuntimeOperatorService } from "../modules/sla/server/sla-runtime-operator-service.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("duplicate reconcile scans do not create duplicate active sla evaluation jobs", async () => {
  const harness = createRuntimeHarness();
  harness.slaTimers.push(makeTimer({ id: "sla-dup-1", organizationId: "org-1", targetEntityId: "wo-1" }));

  const operator = createSlaRuntimeOperatorService({
    repositories: harness.repositories,
    services: {
      runtime: harness.runtime,
      sla: harness.sla,
    } as never,
  });

  const first = await operator.reconcileTimers({
    organizationId: "org-1",
    dueBefore: "2026-05-06T13:00:00.000Z",
    limit: 10,
    now: "2026-05-06T13:00:00.000Z",
    audit: systemAudit("org-1", "2026-05-06T13:00:00.000Z"),
  });
  assert.equal(first.ok, true);
  assert.equal(first.value.enqueueRepairCount, 1);
  assert.equal(harness.jobs.length, 1);

  const second = await operator.reconcileTimers({
    organizationId: "org-1",
    dueBefore: "2026-05-06T13:00:00.000Z",
    limit: 10,
    now: "2026-05-06T13:05:00.000Z",
    audit: systemAudit("org-1", "2026-05-06T13:05:00.000Z"),
  });
  assert.equal(second.ok, true);
  assert.equal(harness.jobs.length, 1);
  assert.equal(harness.slaTimers[0]?.runtimeJobId, harness.jobs[0]?.id);
});

test("scanner remains tenant scoped when repairing overdue timers", async () => {
  const harness = createRuntimeHarness();
  harness.slaTimers.push(
    makeTimer({ id: "sla-org-1", organizationId: "org-1", targetEntityId: "wo-org-1" }),
    makeTimer({ id: "sla-org-2", organizationId: "org-2", targetEntityId: "wo-org-2" }),
  );

  const operator = createSlaRuntimeOperatorService({
    repositories: harness.repositories,
    services: {
      runtime: harness.runtime,
      sla: harness.sla,
    } as never,
  });

  const result = await operator.scanOverdueTimers({
    organizationId: "org-1",
    dueBefore: "2026-05-06T13:00:00.000Z",
    limit: 10,
    now: "2026-05-06T13:00:00.000Z",
    audit: systemAudit("org-1", "2026-05-06T13:00:00.000Z"),
  });
  assert.equal(result.ok, true);
  assert.equal(harness.jobs.length, 1);
  assert.equal(harness.jobs[0]?.organizationId, "org-1");
  assert.equal(harness.slaTimers.find((timer) => timer.id === "sla-org-1")?.runtimeJobId, harness.jobs[0]?.id);
  assert.equal(harness.slaTimers.find((timer) => timer.id === "sla-org-2")?.runtimeJobId, null);
});

function makeTimer(input: { id: string; organizationId: string; targetEntityId: string }) {
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
    runtimeJobId: null,
    evaluatedAt: null,
    satisfiedAt: null,
    breachedAt: null,
    cancelledAt: null,
    failureReason: null,
    createdAt: "2026-05-06T11:00:00.000Z",
    updatedAt: "2026-05-06T11:00:00.000Z",
  };
}

function systemAudit(organizationId: string, now: string) {
  return {
    organizationId,
    actor: { userId: "system", role: "system" as const },
    now,
  };
}
