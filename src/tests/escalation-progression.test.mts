import assert from "node:assert/strict";
import test from "node:test";

import { createEscalationProgressHandler } from "../modules/escalation/index.ts";
import { createSlaTimerEvaluateHandler } from "../modules/sla/index.ts";
import { createWorkerHandlerRegistry } from "../modules/runtime/server/worker-handler-registry.ts";
import { createWorkerRunnerService } from "../modules/runtime/server/worker-runner-service.ts";
import type { DomainServices } from "../server/services/index.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";
import { makeWorkOrder, makeWorkOrderCreatedEvent } from "./support/escalation-fixtures.ts";

test("escalation progression advances deterministically through stages 1, 2, and 3", async () => {
  const harness = createRuntimeHarness();
  const workOrder = makeWorkOrder("wo-escalation-progress-1");
  harness.workOrders.push(workOrder);

  const created = makeWorkOrderCreatedEvent("event-escalation-progress-created", workOrder.id);
  harness.events.push(created);
  await harness.runtime.subscribers.processEvent({ event: created, now: "2026-05-06T09:00:00.000Z" });

  const runner = createWorkerRunnerService(
    harness.runtime,
    createWorkerHandlerRegistry<DomainServices>([
      createSlaTimerEvaluateHandler(harness.sla.evaluator),
      createEscalationProgressHandler(),
    ]),
  );

  await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-sla-progress",
    now: "2026-05-06T13:30:00.000Z",
    jobTypes: ["sla.timer.evaluate"],
  });
  const breachEvent = harness.events.find((item) => item.type === "sla_timer_breached");
  assert.ok(breachEvent);
  await harness.runtime.subscribers.processEvent({ event: breachEvent!, now: "2026-05-06T13:30:05.000Z" });

  await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-escalation-stage1",
    now: "2026-05-06T13:30:10.000Z",
    jobTypes: ["escalation.progress"],
  });
  const stage2At = harness.escalationOrchestrations[0]?.nextStageAt;
  assert.ok(stage2At);
  await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-escalation-stage2",
    now: stage2At!,
    jobTypes: ["escalation.progress"],
  });
  const stage3At = harness.escalationOrchestrations[0]?.nextStageAt;
  assert.ok(stage3At);
  await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-escalation-stage3",
    now: stage3At!,
    jobTypes: ["escalation.progress"],
  });

  const orchestration = harness.escalationOrchestrations[0];
  assert.equal(orchestration?.currentStage?.stageNumber, 3);
  assert.equal(orchestration?.status, "completed");
  assert.equal(orchestration?.stageHistory.length, 3);
  assert.equal(orchestration?.nextStageAt, null);
  assert.deepEqual(
    orchestration?.stageHistory.map((item) => item.stageNumber),
    [1, 2, 3],
  );
  assert.equal(harness.events.filter((item) => item.type === "escalation_progressed").length, 2);
});
