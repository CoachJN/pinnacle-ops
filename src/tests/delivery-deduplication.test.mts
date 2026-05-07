import assert from "node:assert/strict";
import test from "node:test";

import { createDeliveryPlanHandler } from "../modules/delivery/index.ts";
import { createEscalationProgressHandler } from "../modules/escalation/index.ts";
import { createWorkerHandlerRegistry } from "../modules/runtime/server/worker-handler-registry.ts";
import { createWorkerRunnerService } from "../modules/runtime/server/worker-runner-service.ts";
import { createSlaTimerEvaluateHandler } from "../modules/sla/index.ts";
import type { DomainServices } from "../server/services/index.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";
import { makeWorkOrder, makeWorkOrderCreatedEvent } from "./support/escalation-fixtures.ts";

test("replaying the same escalation event does not duplicate active delivery plans", async () => {
  const harness = createRuntimeHarness();
  harness.workOrders.push({
    ...makeWorkOrder("wo-delivery-dedup-1"),
    coordinatorUserId: "user-coordinator",
    managerUserId: "user-manager",
  });

  const created = makeWorkOrderCreatedEvent("event-delivery-dedup-1", "wo-delivery-dedup-1");
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
      createDeliveryPlanHandler(),
    ]),
  );

  await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-delivery-dedup-sla",
    now: "2026-05-06T13:30:00.000Z",
    jobTypes: ["sla.timer.evaluate"],
  });
  const breachEvent = harness.events.find((item) => item.type === "sla_timer_breached");
  assert.ok(breachEvent);
  await harness.runtime.subscribers.processEvent({
    event: breachEvent!,
    now: "2026-05-06T13:30:05.000Z",
  });
  await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-delivery-dedup-escalation",
    now: "2026-05-06T13:30:10.000Z",
    jobTypes: ["escalation.progress"],
  });

  const escalationEvent = harness.events.find((item) => item.type === "escalation_created");
  assert.ok(escalationEvent);
  const first = await harness.runtime.subscribers.processEvent({
    event: escalationEvent!,
    now: "2026-05-06T13:30:11.000Z",
  });
  assert.equal(first.ok, true);
  await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-delivery-dedup-delivery",
    now: "2026-05-06T13:30:12.000Z",
    jobTypes: ["delivery.plan.process"],
    maxJobs: 5,
  });

  const replay = await harness.runtime.subscribers.processEvent({
    event: escalationEvent!,
    now: "2026-05-06T13:30:13.000Z",
    force: true,
  });
  assert.equal(replay.ok, true);
  await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-delivery-dedup-replay",
    now: "2026-05-06T13:30:14.000Z",
    jobTypes: ["delivery.plan.process"],
    maxJobs: 5,
  });

  assert.equal(harness.deliveryPlans.filter((plan) => plan.status === "scheduled").length, 3);
  assert.equal(harness.deliveryPlans.filter((plan) => plan.status === "suppressed").length, 1);
  assert.equal(harness.deliveryPlans.length, 4);
});
