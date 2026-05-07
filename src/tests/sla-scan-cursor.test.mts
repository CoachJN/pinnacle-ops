import assert from "node:assert/strict";
import test from "node:test";

import { createSlaRuntimeOperatorService } from "../modules/sla/server/sla-runtime-operator-service.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("sla scan cursor progresses durably across bounded batches", async () => {
  const harness = createRuntimeHarness();
  harness.slaTimers.push(
    makeTimer({ id: "sla-1", dueAt: "2026-05-06T12:00:00.000Z", targetEntityId: "wo-1" }),
    makeTimer({ id: "sla-2", dueAt: "2026-05-06T12:05:00.000Z", targetEntityId: "wo-2" }),
  );

  const operator = createSlaRuntimeOperatorService({
    repositories: harness.repositories,
    services: {
      runtime: harness.runtime,
      sla: harness.sla,
    } as never,
  });

  const first = await operator.scanOverdueTimers({
    organizationId: "org-1",
    dueBefore: "2026-05-06T13:00:00.000Z",
    limit: 1,
    now: "2026-05-06T13:00:00.000Z",
    audit: systemAudit("org-1", "2026-05-06T13:00:00.000Z"),
  });
  assert.equal(first.ok, true);
  assert.equal(first.value.scannedCount, 1);
  assert.equal(first.value.cursor.nextId, "sla-1");

  const second = await operator.scanOverdueTimers({
    organizationId: "org-1",
    dueBefore: "2026-05-06T13:00:00.000Z",
    limit: 1,
    now: "2026-05-06T13:01:00.000Z",
    audit: systemAudit("org-1", "2026-05-06T13:01:00.000Z"),
  });
  assert.equal(second.ok, true);
  assert.equal(second.value.scannedCount, 1);
  assert.equal(second.value.cursor.previousId, "sla-1");
  assert.equal(second.value.cursor.nextId, "sla-2");

  const cursor = harness.slaScanCursors[0];
  assert.equal(cursor?.lastScannedId, "sla-2");
  assert.equal(cursor?.status, "completed");
  assert.equal(cursor?.recentRuns.length, 2);
});

function makeTimer(input: { id: string; dueAt: string; targetEntityId: string }) {
  return {
    id: input.id,
    organizationId: "org-1",
    tenantId: "org-1",
    type: "work_order.first_response_due" as const,
    targetEntityType: "work_order" as const,
    targetEntityId: input.targetEntityId,
    status: "scheduled" as const,
    dueAt: input.dueAt,
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
