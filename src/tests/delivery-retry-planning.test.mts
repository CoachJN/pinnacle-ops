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

test("delivery planning schedules transport-ready plans without legacy follow-up planning jobs", async () => {
  const harness = createRuntimeHarness();
  harness.workOrders.push({
    ...makeWorkOrder("wo-delivery-retry-1"),
    coordinatorUserId: "user-coordinator",
    managerUserId: "user-manager",
  });

  const created = makeWorkOrderCreatedEvent("event-delivery-retry-1", "wo-delivery-retry-1");
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
    workerId: "worker-delivery-retry-sla",
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
    workerId: "worker-delivery-retry-escalation",
    now: "2026-05-06T13:30:10.000Z",
    jobTypes: ["escalation.progress"],
  });

  const escalationEvent = harness.events.find((item) => item.type === "escalation_created");
  assert.ok(escalationEvent);
  await harness.runtime.subscribers.processEvent({
    event: escalationEvent!,
    now: "2026-05-06T13:30:11.000Z",
  });
  await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-delivery-retry-initial",
    now: "2026-05-06T13:30:12.000Z",
    jobTypes: ["delivery.plan.process"],
    maxJobs: 5,
  });

  const scheduledPlans = harness.deliveryPlans.filter((plan) => plan.status === "scheduled");
  assert.equal(scheduledPlans.length, 3);
  assert.equal(scheduledPlans.every((plan) => plan.nextAttemptAt !== null), true);
  assert.equal(scheduledPlans.every((plan) => plan.activeRuntimeJobId === null), true);
  assert.equal(
    harness.jobs.filter((job) => job.type === "delivery.plan.process" && job.payload.action === "process_existing_plan").length,
    0,
  );
  assert.equal(harness.events.filter((item) => item.type === "delivery_scheduled").length, 3);
});
