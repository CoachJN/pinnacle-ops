import assert from "node:assert/strict";
import test from "node:test";

import { createEscalationProgressHandler } from "../modules/escalation/index.ts";
import { createSlaTimerEvaluateHandler } from "../modules/sla/index.ts";
import { createWorkerHandlerRegistry } from "../modules/runtime/server/worker-handler-registry.ts";
import { createWorkerRunnerService } from "../modules/runtime/server/worker-runner-service.ts";
import type { DomainServices } from "../server/services/index.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";
import {
  makeInternalMessageEvent,
  makeWorkOrder,
  makeWorkOrderCreatedEvent,
} from "./support/escalation-fixtures.ts";

test("resolved breached SLA timers cancel active escalations safely", async () => {
  const harness = createRuntimeHarness();
  const workOrder = makeWorkOrder("wo-escalation-cancel-1");
  harness.workOrders.push(workOrder);

  const created = makeWorkOrderCreatedEvent("event-escalation-cancel-created", workOrder.id);
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
    workerId: "worker-sla-cancel-breach",
    now: "2026-05-06T13:30:00.000Z",
    jobTypes: ["sla.timer.evaluate"],
  });
  const breachEvent = harness.events.find((item) => item.type === "sla_timer_breached");
  assert.ok(breachEvent);
  await harness.runtime.subscribers.processEvent({ event: breachEvent!, now: "2026-05-06T13:30:05.000Z" });
  await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-escalation-cancel-stage1",
    now: "2026-05-06T13:30:10.000Z",
    jobTypes: ["escalation.progress"],
  });

  const response = makeInternalMessageEvent(
    "event-escalation-cancel-response",
    workOrder.id,
    "2026-05-06T13:45:00.000Z",
  );
  harness.events.push(response);
  await harness.runtime.subscribers.processEvent({ event: response, now: "2026-05-06T13:45:00.000Z" });
  await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-sla-cancel-satisfied",
    now: "2026-05-06T13:45:10.000Z",
    jobTypes: ["sla.timer.evaluate"],
  });

  const satisfiedEvent = harness.events.find((item) => item.type === "sla_timer_satisfied");
  assert.ok(satisfiedEvent);
  await harness.runtime.subscribers.processEvent({
    event: satisfiedEvent!,
    now: "2026-05-06T13:45:15.000Z",
  });
  await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-escalation-cancel-final",
    now: "2026-05-06T13:45:20.000Z",
    jobTypes: ["escalation.progress"],
  });

  assert.equal(harness.escalationOrchestrations[0]?.status, "cancelled");
  assert.equal(harness.events.some((item) => item.type === "escalation_cancelled"), true);
  assert.equal(harness.escalationOrchestrations[0]?.cancellationReason, "sla_timer_satisfied");
});
