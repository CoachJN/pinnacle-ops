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

test("delivery runtime creates durable plans from escalation events and exposes diagnostics", async () => {
  const harness = createRuntimeHarness();
  const workOrder = {
    ...makeWorkOrder("wo-delivery-runtime-1"),
    coordinatorUserId: "user-coordinator",
    managerUserId: "user-manager",
  };
  harness.workOrders.push(workOrder);

  const created = makeWorkOrderCreatedEvent("event-delivery-runtime-1", workOrder.id);
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
    workerId: "worker-sla-delivery-runtime",
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
    workerId: "worker-escalation-delivery-runtime",
    now: "2026-05-06T13:30:10.000Z",
    jobTypes: ["escalation.progress"],
    maxJobs: 5,
  });

  const escalationEvent = harness.events.find((item) => item.type === "escalation_created");
  assert.ok(escalationEvent);
  await harness.runtime.subscribers.processEvent({
    event: escalationEvent!,
    now: "2026-05-06T13:30:11.000Z",
  });

  const deliveryBatch = await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-delivery-plan-runtime",
    now: "2026-05-06T13:30:12.000Z",
    jobTypes: ["delivery.plan.process"],
    maxJobs: 5,
  });
  assert.equal(deliveryBatch.ok, true);
  assert.equal(harness.deliveryPlans.length, 4);
  assert.equal(harness.deliveryPlans.filter((plan) => plan.status === "scheduled").length, 3);
  assert.equal(harness.deliveryPlans.filter((plan) => plan.status === "suppressed").length, 1);
  assert.equal(
    harness.events.filter((item) => item.type === "delivery_planned").length,
    3,
  );
  assert.equal(
    harness.events.filter((item) => item.type === "delivery_suppressed").length,
    1,
  );

  const diagnostics = await harness.delivery.diagnostics.getSummary({
    organizationId: "org-1",
    limit: 20,
  });
  assert.equal(diagnostics.ok, true);
  assert.equal(diagnostics.value.tenantSummary.totalPlans, 4);
  assert.equal(diagnostics.value.tenantSummary.suppressedCount, 1);
  assert.equal(diagnostics.value.activeDeliveryPlans.length, 3);
});
