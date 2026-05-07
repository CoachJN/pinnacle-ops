import assert from "node:assert/strict";
import test from "node:test";

import type { DomainServices } from "../server/services/index.ts";
import type { DomainEvent } from "../server/events/types.ts";
import { USER_ROLES } from "../types/permissions.ts";
import { createRuntimeOperatorService } from "../modules/runtime/server/runtime-operator-service.ts";
import { createWorkerHandlerRegistry } from "../modules/runtime/server/worker-handler-registry.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("runtime operator service composes diagnostics, event replay, and worker processing", async () => {
  const harness = createRuntimeHarness();
  const event = makeWorkOrderCreatedEvent("event-operator-1");
  harness.events.push(event);

  const operator = createRuntimeOperatorService({
    repositories: {
      domainEvents: createDomainEventRepositoryHarness(harness.events) as never,
      runtimeDeadLetters: createDeadLetterRepositoryHarness(harness.deadLetters) as never,
      runtimeJobs: createJobRepositoryHarness(harness.jobs) as never,
    },
    services: {
      runtime: harness.runtime,
    } as DomainServices,
    handlerRegistry: createWorkerHandlerRegistry<DomainServices>([
      {
        type: "sla.timer.evaluate",
        description: "Operator test handler.",
        async handle() {
          return {
            success: true,
            message: "sla timer acknowledged",
          };
        },
      },
    ]),
  });

  const eventResult = await operator.processEvents({
    organizationId: "org-1",
    eventId: event.id,
    now: "2026-05-06T23:00:00.000Z",
  });
  assert.equal(eventResult.ok, true);
  assert.equal(harness.jobs.length, 1);

  const dryRun = await operator.processJobs({
    organizationId: "org-1",
    services: { runtime: harness.runtime } as DomainServices,
    workerId: "operator-worker",
    dryRun: true,
    now: "2026-05-07T03:00:05.000Z",
  });
  assert.equal(dryRun.ok, true);
  assert.equal(dryRun.value.eligibleJobs[0]?.handlerRegistered, true);

  const processed = await operator.processJobs({
    organizationId: "org-1",
    services: { runtime: harness.runtime } as DomainServices,
    workerId: "operator-worker",
    now: "2026-05-07T03:00:05.000Z",
  });
  assert.equal(processed.ok, true);
  assert.equal(processed.value.completedCount, 1);

  const diagnostics = await operator.getDiagnostics({
    organizationId: "org-1",
    limit: 10,
  });
  assert.equal(diagnostics.ok, true);
  assert.equal(diagnostics.value.runtime.deadLetterCount, 0);
  assert.equal(diagnostics.value.execution.registeredHandlers[0]?.type, "sla.timer.evaluate");
});

function createDomainEventRepositoryHarness(events: DomainEvent[]) {
  return {
    async listByOrganizationId() {
      return { items: events, count: events.length };
    },
  };
}

function createJobRepositoryHarness(jobs: Array<{ id: string }>) {
  return {
    async getById(id: string) {
      return jobs.find((item) => item.id === id) ?? null;
    },
  };
}

function createDeadLetterRepositoryHarness(deadLetters: Array<{ id: string }>) {
  return {
    async getById(id: string) {
      return deadLetters.find((item) => item.id === id) ?? null;
    },
  };
}

function makeWorkOrderCreatedEvent(eventId: string): DomainEvent<"work_order_created"> {
  return {
    id: eventId,
    organizationId: "org-1",
    tenantId: "org-1",
    workOrderId: "wo-operator-1",
    type: "work_order_created",
    actor: {
      actorId: "manager-operator-1",
      actorType: "user",
      actorRole: USER_ROLES.Manager,
      displayName: "Manager Operator One",
    },
    visibility: "internal",
    occurredAt: "2026-05-06T22:59:00.000Z",
    lifecycleStatus: "new",
    entity: {
      entityType: "work_order",
      entityId: "wo-operator-1",
      label: "WO-OPERATOR-1",
    },
    summary: "Work order created.",
    metadata: {
      requestId: "req-operator-1",
      reason: null,
      correlationId: "corr-operator-1",
      details: {},
    },
    payload: {
      lifecycleStatus: "new",
      priority: "high",
      title: "Roof leak",
    },
  };
}
