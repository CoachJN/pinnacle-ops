import assert from "node:assert/strict";
import test from "node:test";

import { createSlaTimerEvaluateHandler } from "../modules/sla/server/handlers/sla-timer-evaluate-handler.ts";
import { createWorkerHandlerRegistry } from "../modules/runtime/server/worker-handler-registry.ts";
import { createWorkerRunnerService } from "../modules/runtime/server/worker-runner-service.ts";
import { createRuntimeHarness } from "./support/runtime-harness.ts";
import type { DomainEvent } from "../server/events/types.ts";
import type { DomainServices } from "../server/services/index.ts";
import { USER_ROLES } from "../types/permissions.ts";
import type { WorkOrder } from "../server/repositories/index.ts";

test("sla timer handler marks satisfied from canonical internal response evidence", async () => {
  const harness = createRuntimeHarness();
  const workOrder = makeWorkOrder("wo-sla-handler-satisfied-1");
  harness.workOrders.push(workOrder);

  const created = makeWorkOrderCreatedEvent("event-sla-handler-created-1", workOrder.id);
  harness.events.push(created);
  await harness.runtime.subscribers.processEvent({
    event: created,
    now: "2026-05-06T08:00:00.000Z",
  });

  harness.events.push(makeInternalMessageEvent("event-sla-handler-message-1", workOrder.id));

  const runner = createWorkerRunnerService(
    harness.runtime,
    createWorkerHandlerRegistry<DomainServices>([
      createSlaTimerEvaluateHandler(harness.sla.evaluator),
    ]),
  );
  const processed = await runner.processPending({
    organizationId: "org-1",
    services: {} as DomainServices,
    workerId: "worker-sla-satisfied",
    now: "2026-05-06T12:30:00.000Z",
  });

  assert.equal(processed.ok, true);
  assert.equal(harness.slaTimers[0]?.status, "satisfied");
  assert.equal(harness.events.some((item) => item.type === "sla_timer_breached"), false);
});

test("sla timer handler breaches once, emits canonical event, and does not mutate work orders", async () => {
  const harness = createRuntimeHarness();
  const workOrder = makeWorkOrder("wo-sla-handler-breach-1");
  harness.workOrders.push(workOrder);

  const created = makeWorkOrderCreatedEvent("event-sla-handler-created-2", workOrder.id);
  harness.events.push(created);
  await harness.runtime.subscribers.processEvent({
    event: created,
    now: "2026-05-06T08:00:00.000Z",
  });

  const runner = createWorkerRunnerService(
    harness.runtime,
    createWorkerHandlerRegistry<DomainServices>([
      createSlaTimerEvaluateHandler(harness.sla.evaluator),
    ]),
  );
  const beforeStatus = harness.workOrders[0]?.lifecycleStatus;
  const processed = await runner.processPending({
    organizationId: "org-1",
    services: {} as DomainServices,
    workerId: "worker-sla-breach",
    now: "2026-05-06T12:30:00.000Z",
  });

  assert.equal(processed.ok, true);
  assert.equal(harness.slaTimers[0]?.status, "breached");
  assert.equal(harness.events.filter((item) => item.type === "sla_timer_breached").length, 1);
  assert.equal(harness.workOrders[0]?.lifecycleStatus, beforeStatus);
});

test("sla timer handler ignores stale superseded jobs safely", async () => {
  const harness = createRuntimeHarness();
  const workOrder = makeWorkOrder("wo-sla-handler-stale-1");
  harness.workOrders.push(workOrder);

  const created = makeWorkOrderCreatedEvent("event-sla-handler-created-3", workOrder.id);
  harness.events.push(created);
  await harness.runtime.subscribers.processEvent({
    event: created,
    now: "2026-05-06T08:00:00.000Z",
  });
  const originalJobId = harness.jobs[0]?.id;

  const response = makeInternalMessageEvent("event-sla-handler-message-2", workOrder.id);
  harness.events.push(response);
  await harness.runtime.subscribers.processEvent({
    event: response,
    now: "2026-05-06T08:30:00.000Z",
  });

  const handler = createSlaTimerEvaluateHandler(harness.sla.evaluator);
  const staleResult = await handler.handle({
    job: harness.jobs[0]!,
    payload: harness.jobs[0]!.payload,
    organizationId: "org-1",
    correlationId: harness.jobs[0]!.correlationId,
    causationId: harness.jobs[0]!.causationId,
    sourceEventId: harness.jobs[0]!.sourceEventId,
    attemptCount: harness.jobs[0]!.attemptCount,
    workerId: "worker-sla-stale",
    startedAt: "2026-05-06T12:30:00.000Z",
    services: {} as DomainServices,
    heartbeat: {
      async extendLease() {
        return harness.jobs[0]!;
      },
    },
  });

  assert.equal(staleResult.success, true);
  assert.equal(staleResult.metadata?.timerStatus, "scheduled");
  assert.notEqual(harness.slaTimers[0]?.runtimeJobId, originalJobId);
});

test("sla timer handler invalid payload dead-letters through the runtime substrate", async () => {
  const harness = createRuntimeHarness();
  const queued = await harness.runtime.jobs.enqueue({
    organizationId: "org-1",
    actor: { userId: "system", role: "system" },
    now: "2026-05-06T08:00:00.000Z",
    type: "sla.timer.evaluate",
    payload: {
      timerId: "missing",
      payloadVersion: "v9",
    },
    payloadVersion: "v1",
    idempotencyKey: "sla.timer.evaluate:invalid-payload",
    correlationId: "corr-invalid-payload",
    causationId: "cause-invalid-payload",
    maxAttempts: 1,
  });
  assert.equal(queued.ok, true);

  const runner = createWorkerRunnerService(
    harness.runtime,
    createWorkerHandlerRegistry<DomainServices>([
      createSlaTimerEvaluateHandler(harness.sla.evaluator),
    ]),
  );
  const processed = await runner.processPending({
    organizationId: "org-1",
    services: {} as DomainServices,
    workerId: "worker-sla-invalid",
    now: "2026-05-06T08:01:00.000Z",
  });

  assert.equal(processed.ok, true);
  assert.equal(harness.jobs[0]?.status, "dead_lettered");
  assert.equal(harness.deadLetters.length, 1);
});

function makeWorkOrder(workOrderId: string): WorkOrder {
  return {
    id: workOrderId,
    organizationId: "org-1",
    createdAt: "2026-05-06T08:00:00.000Z",
    updatedAt: "2026-05-06T08:00:00.000Z",
    createdByUserId: "manager-1",
    updatedByUserId: "manager-1",
    recordStatus: "active",
    isDeleted: false,
    deletedAt: null,
    deletedByUserId: null,
    tenantId: "org-1",
    workOrderNumber: `WO-${workOrderId.toUpperCase()}`,
    title: "Roof leak",
    description: "Roof leak in lobby",
    poNumber: null,
    requestedByName: null,
    requestedByEmail: null,
    requestedByPhone: null,
    requestedServiceDate: null,
    dueDate: null,
    category: null,
    requiresQuote: false,
    quoteRequiredThresholdCents: null,
    lifecycleStatus: "new",
    status: "new",
    assignmentStatus: null,
    quoteSummaryStatus: "not_required",
    invoiceSummaryStatus: "not_ready",
    approvalStatus: "not_required",
    priority: "high",
    clientOrganizationId: "client-1",
    locationId: "location-1",
    requestedByContactId: null,
    siteContactId: null,
    coordinatorUserId: null,
    managerUserId: null,
    assignedCoordinatorUserId: null,
    assignedManagerUserId: null,
    assignedContractorOrgId: null,
    assignedContractorContactId: null,
    financeOwnerUserId: null,
    quoteReviewerUserId: null,
    currentQuoteId: null,
    currentInvoiceId: null,
    currentQuoteVersionNumber: null,
    invoiceNumber: null,
    clientSnapshot: { id: "client-1", name: "Client One" },
    locationSnapshot: { id: "location-1", name: "Lobby", addressText: null },
    contractorSnapshot: null,
    lastActivityAt: "2026-05-06T08:00:00.000Z",
    nextActionOwnerType: null,
    nextActionDueAt: null,
    isEscalated: false,
    escalationReason: null,
    holdReason: null,
    previousLifecycleStatus: null,
    intakeReceivedAt: "2026-05-06T08:00:00.000Z",
    triagedAt: null,
    assignedAt: null,
    contractorContactedAt: null,
    contractorRespondedAt: null,
    contractorScheduledAt: null,
    workStartedAt: null,
    quoteRequestedAt: null,
    contractorQuoteReceivedAt: null,
    quoteReviewStartedAt: null,
    clientApprovalRequestedAt: null,
    clientApprovedAt: null,
    workCompletedAt: null,
    completionReviewStartedAt: null,
    readyForInvoicingAt: null,
    invoiceSentAt: null,
    paidAt: null,
    closedAt: null,
    cancelledAt: null,
    holdStartedAt: null,
    escalatedAt: null,
  } as unknown as WorkOrder;
}

function makeWorkOrderCreatedEvent(
  eventId: string,
  workOrderId: string,
): DomainEvent<"work_order_created"> {
  return {
    id: eventId,
    organizationId: "org-1",
    tenantId: "org-1",
    workOrderId,
    type: "work_order_created",
    actor: {
      actorId: "manager-1",
      actorType: "user",
      actorRole: USER_ROLES.Manager,
      displayName: "Manager One",
    },
    visibility: "internal",
    occurredAt: "2026-05-06T08:00:00.000Z",
    lifecycleStatus: "new",
    entity: {
      entityType: "work_order",
      entityId: workOrderId,
      label: workOrderId.toUpperCase(),
    },
    summary: "Work order created.",
    metadata: {
      requestId: "req-sla-handler-created",
      reason: null,
      correlationId: "corr-sla-handler",
      details: {},
    },
    payload: {
      lifecycleStatus: "new",
      priority: "high",
      title: "Roof leak",
    },
  };
}

function makeInternalMessageEvent(
  eventId: string,
  workOrderId: string,
): DomainEvent<"communication_message_created"> {
  return {
    id: eventId,
    organizationId: "org-1",
    tenantId: "org-1",
    workOrderId,
    type: "communication_message_created",
    actor: {
      actorId: "manager-1",
      actorType: "user",
      actorRole: USER_ROLES.Manager,
      displayName: "Manager One",
    },
    visibility: "internal",
    occurredAt: "2026-05-06T08:15:00.000Z",
    lifecycleStatus: "new",
    entity: {
      entityType: "communication_message",
      entityId: `${eventId}-message`,
      label: "Internal note",
    },
    summary: "Created internal note.",
    metadata: {
      requestId: "req-sla-handler-message",
      reason: null,
      correlationId: "corr-sla-handler",
      details: {},
    },
    payload: {
      threadId: `${eventId}-thread`,
      messageId: `${eventId}-message`,
      channel: "internal_note",
      direction: "internal",
    },
  };
}
