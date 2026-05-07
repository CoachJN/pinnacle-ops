import assert from "node:assert/strict";
import test from "node:test";

import {
  TRANSPORT_ADAPTER_TYPES,
  createTransportExecuteHandler,
  createTransportServices,
  type TransportAdapter,
} from "../modules/transport/index.ts";
import { createWorkerHandlerRegistry } from "../modules/runtime/server/worker-handler-registry.ts";
import { createWorkerRunnerService } from "../modules/runtime/server/worker-runner-service.ts";
import { createDomainEventService } from "../server/services/domain-event-service.ts";
import type { DomainServices } from "../server/services/index.ts";
import type { DeliveryPlan } from "../modules/delivery/index.ts";
import type { FirestoreRepositories } from "../server/repositories/index.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";

test("transport retry planning is durable, bounded, and replay-safe", async () => {
  const harness = createRuntimeHarness();
  harness.deliveryPlans.push(makeDeliveryPlan("delivery-plan-retry-1", "wo-transport-retry-1"));

  const flakyAdapter: TransportAdapter = {
    adapterType: TRANSPORT_ADAPTER_TYPES.Internal,
    supportsChannel(channel) {
      return channel === "internal";
    },
    async execute(input) {
      if (input.payload.attempt.retryCount === 0) {
        return {
          outcome: "failed",
          message: "Temporary adapter failure.",
          retryable: true,
          failureCode: "internal_timeout",
          failureReason: "Adapter timed out.",
        };
      }
      return {
        outcome: "succeeded",
        message: "Retried adapter succeeded.",
        receipt: {
          deliveryPlanId: input.payload.deliveryPlan.id,
          deliveryAttemptId: input.payload.attempt.id,
          providerMessageId: `retry-message:${input.payload.attempt.retryCount}`,
          providerCorrelationId: `retry-correlation:${input.payload.attempt.correlationId}`,
          providerReceiptId: `retry-receipt:${input.payload.attempt.id}`,
        },
      };
    },
  };
  const noopRepository = {
    newId: () => "noop",
    getById: async () => null,
    create: async (entity: unknown) => ({ id: "noop", item: entity }),
    save: async (entity: unknown) => ({ id: "noop", item: entity }),
    listByWorkOrderId: async () => ({ items: [], count: 0 }),
    listByEntity: async () => ({ items: [], count: 0 }),
    listByOrganizationId: async () => ({ items: [], count: 0 }),
  };
  harness.transport = createTransportServices(
    harness.repositories as Pick<FirestoreRepositories, "deliveryAttempts" | "deliveryPlans" | "domainEvents">,
    {
      domainEvents: createDomainEventService({
        domainEvents: harness.repositories.domainEvents,
        transitionEvents: noopRepository as never,
        transitionAudits: noopRepository as never,
      }),
      deliveryPolicy: harness.delivery.policy,
      adapters: [flakyAdapter],
    },
  );

  const queued = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "system", role: "system" },
    now: "2026-05-06T13:00:00.000Z",
    type: "transport.execute",
    payloadVersion: "v1",
    payload: {
      payloadVersion: "v1",
      deliveryPlanId: "delivery-plan-retry-1",
      deliveryType: "escalation.first_response_breach_notification",
      attemptNumber: 0,
      reason: "delivery_scheduled",
      triggerEventType: "delivery_scheduled",
    },
    idempotencyKey: "transport.execute:delivery-plan-retry-1:attempt:0",
    correlationId: "corr-transport-retry-1",
    causationId: "delivery-plan-retry-1",
    sourceEventId: "event-transport-retry-1",
    maxAttempts: 1,
  });
  assert.equal(queued.ok, true);

  const runner = createWorkerRunnerService(
    harness.runtime,
    createWorkerHandlerRegistry<DomainServices>([createTransportExecuteHandler()]),
  );

  const first = await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-transport-retry-1",
    now: "2026-05-06T13:01:00.000Z",
    jobTypes: ["transport.execute"],
    maxJobs: 1,
  });
  assert.equal(first.ok, true);
  assert.equal(harness.deliveryAttempts.length, 1);
  assert.equal(harness.deliveryAttempts[0]?.status, "retry_scheduled");
  assert.equal(harness.deliveryAttempts[0]?.nextRetryAt !== null, true);
  assert.equal(harness.deliveryPlans[0]?.status, "scheduled");

  const retryJob = harness.jobs.find((job) => job.idempotencyKey === "transport.execute:delivery-plan-retry-1:attempt:1");
  assert.ok(retryJob);

  const duplicateEnqueue = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "system", role: "system" },
    now: "2026-05-06T13:01:30.000Z",
    type: "transport.execute",
    payloadVersion: "v1",
    payload: retryJob!.payload,
    idempotencyKey: retryJob!.idempotencyKey,
    correlationId: retryJob!.correlationId,
    causationId: retryJob!.causationId,
    sourceEventId: retryJob!.sourceEventId,
    maxAttempts: 1,
    runAfter: retryJob!.runAfter,
  });
  assert.equal(duplicateEnqueue.ok, true);
  assert.equal(duplicateEnqueue.value.id, retryJob!.id);

  const second = await runner.processPending({
    organizationId: "org-1",
    services: harness as unknown as DomainServices,
    workerId: "worker-transport-retry-2",
    now: retryJob!.runAfter,
    jobTypes: ["transport.execute"],
    maxJobs: 1,
  });
  assert.equal(second.ok, true);

  assert.equal(harness.deliveryAttempts.length, 2);
  assert.equal(harness.deliveryAttempts[1]?.status, "succeeded");
  assert.equal(harness.deliveryAttempts[1]?.retryCount, 1);
  assert.equal(harness.deliveryAttempts.every((attempt) => attempt.correlationId === "corr-transport-retry-1"), true);
  assert.equal(harness.deliveryAttempts.every((attempt) => attempt.sourceEventId === "event-transport-retry-1"), true);
  assert.equal(harness.deliveryPlans[0]?.status, "completed");
});

function makeDeliveryPlan(id: string, workOrderId: string): DeliveryPlan {
  return {
    id,
    organizationId: "org-1",
    tenantId: "org-1",
    deliveryType: "escalation.first_response_breach_notification",
    sourceEscalationId: "esc-transport-retry-1",
    sourceEscalationStageNumber: 1,
    sourceEventId: "event-transport-retry-1",
    correlationId: "corr-transport-retry-1",
    causationId: "cause-transport-retry-1",
    idempotencyKey: `delivery.plan:${id}`,
    targetEntityType: "work_order",
    targetEntityId: workOrderId,
    recipientType: "assigned_manager",
    recipientId: "user-manager",
    recipientAddress: "manager@example.com",
    channel: "internal",
    templateId: "delivery.escalation.first_response_breach",
    templateVersion: "v1",
    priority: "high",
    status: "scheduled",
    retryCount: 0,
    nextAttemptAt: "2026-05-06T13:00:00.000Z",
    suppressionReason: null,
    cancellationReason: null,
    activeRuntimeJobId: null,
    noopCount: 0,
    createdAt: "2026-05-06T12:59:00.000Z",
    updatedAt: "2026-05-06T12:59:00.000Z",
  };
}
