import assert from "node:assert/strict";
import test from "node:test";

import { createEscalationProgressHandler } from "../modules/escalation/index.ts";
import { createSlaTimerEvaluateHandler } from "../modules/sla/index.ts";
import { createWorkerHandlerRegistry } from "../modules/runtime/server/worker-handler-registry.ts";
import { createWorkerRunnerService } from "../modules/runtime/server/worker-runner-service.ts";
import type { DomainServices } from "../server/services/index.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";
import {
  makeWorkOrder,
  makeWorkOrderCreatedEvent,
} from "./support/escalation-fixtures.ts";

test("escalation runtime creates a durable stage-1 orchestration from a canonical SLA breach", async () => {
  const harness = createRuntimeHarness();
  const workOrder = makeWorkOrder("wo-escalation-runtime-1");
  harness.workOrders.push(workOrder);

  const created = makeWorkOrderCreatedEvent("event-escalation-created-1", workOrder.id);
  harness.events.push(created);
  await harness.runtime.subscribers.processEvent({
    event: created,
    now: "2026-05-06T09:00:00.000Z",
  });

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
    workerId: "worker-sla-breach",
    now: "2026-05-06T13:30:00.000Z",
    jobTypes: ["sla.timer.evaluate"],
  });

  const breachEvent = harness.events.find((item) => item.type === "sla_timer_breached");
  assert.ok(breachEvent);

  await harness.runtime.subscribers.processEvent({
    event: breachEvent!,
    now: "2026-05-06T13:30:05.000Z",
  });

  const processed = await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-escalation-stage-1",
    now: "2026-05-06T13:30:10.000Z",
    jobTypes: ["escalation.progress"],
  });

  assert.equal(processed.ok, true);
  assert.equal(harness.escalationOrchestrations.length, 1);
  assert.equal(harness.escalationOrchestrations[0]?.status, "active");
  assert.equal(harness.escalationOrchestrations[0]?.currentStage?.stageNumber, 1);
  assert.equal(harness.escalationOrchestrations[0]?.stageHistory.length, 1);
  assert.equal(
    Date.parse(harness.escalationOrchestrations[0]!.nextStageAt!) -
      Date.parse(harness.escalationOrchestrations[0]!.lastProgressedAt!),
    60 * 60 * 1000,
  );
  assert.equal(harness.events.some((item) => item.type === "escalation_created"), true);
  assert.equal(harness.workOrders[0]?.lifecycleStatus, "new");
});
