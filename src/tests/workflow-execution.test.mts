import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type {
  TransitionAuditRecord,
  TransitionEventRecord,
} from "../lib/workflows/audit/index.ts";
import {
  buildWorkflowMonitoringSummary,
  createWorkflowSlaTimersFromEvent,
  evaluateWorkflowSlaBreaches,
  processScheduledWorkflowAction,
  processScheduledWorkflowActionsBatch,
  satisfyWorkflowSlaTimersForEvent,
  WORKFLOW_SLA_DEFINITIONS,
  type ScheduledWorkflowExecutionRecord,
  type ScheduledWorkflowExecutionStatus,
  type WorkflowExecutionAdapters,
  type WorkflowExecutionAttempt,
  type WorkflowSlaBreachRecord,
  type WorkflowSlaTimer,
} from "../lib/workflows/execution/index.ts";
import {
  INVOICE_STATUS,
  QUOTE_STATUS,
  WORK_ORDER_STATUS,
  type InvoiceLifecycleStatus,
  type WorkOrderLifecycleStatus,
} from "../lib/workflows/lifecycle/index.ts";
import { PLATFORM_ROLES } from "../lib/workflows/rbac-transition/index.ts";
import {
  applyInvoiceTransition,
  applyWorkOrderTransition,
  type LifecycleTransitionRepositories,
} from "../lib/workflows/transition-service/index.ts";
import type { ClientInvoice as Invoice } from "../types/invoice.ts";
import type { WorkOrder } from "../types/work-order.ts";

describe("scheduled workflow execution", () => {
  test("due scheduled action can be claimed and processed successfully", async () => {
    const action = makeExecutionRecord();
    const repositories = makeExecutionRepositories({ actions: [action] });

    const result = await processScheduledWorkflowActionsBatch({
      workerId: "worker-1",
      now: "2026-01-01T00:00:00.000Z",
      limit: 10,
      adapters: repositories,
    });

    assert.equal(result.claimedCount, 1);
    assert.equal(result.completedCount, 1);
    assert.equal(repositories.actions[0].status, "COMPLETED");
    assert.equal(repositories.attempts[0].status, "COMPLETED");
  });

  test("unsupported action type fails safely", async () => {
    const action = makeExecutionRecord({
      actionType: "UNSUPPORTED_ACTION" as never,
    });
    const repositories = makeExecutionRepositories({ actions: [action] });

    const result = await processScheduledWorkflowAction({
      record: action,
      workerId: "worker-1",
      now: "2026-01-01T00:00:00.000Z",
      adapters: repositories,
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, "FAILED");
    assert.equal(result.failureCode, "UNSUPPORTED_ACTION_TYPE");
    assert.equal(repositories.actions[0].status, "FAILED");
  });

  test("retryable failure schedules retry", async () => {
    const action = makeExecutionRecord();
    const repositories = makeExecutionRepositories({
      actions: [action],
      failExecution: true,
    });

    const result = await processScheduledWorkflowAction({
      record: action,
      workerId: "worker-1",
      now: "2026-01-01T00:00:00.000Z",
      adapters: repositories,
    });

    assert.equal(result.ok, false);
    assert.equal(result.status, "RETRY_SCHEDULED");
    assert.ok(result.nextRetryAt);
    assert.equal(repositories.actions[0].status, "RETRY_SCHEDULED");
  });

  test("max retries exceeded leads to FAILED", async () => {
    const action = makeExecutionRecord({ attemptCount: 2, maxAttempts: 3 });
    const repositories = makeExecutionRepositories({
      actions: [action],
      failExecution: true,
    });

    const result = await processScheduledWorkflowAction({
      record: action,
      workerId: "worker-1",
      now: "2026-01-01T00:00:00.000Z",
      adapters: repositories,
    });

    assert.equal(result.status, "FAILED");
    assert.equal(result.failureCode, "MAX_RETRIES_EXCEEDED");
    assert.equal(repositories.actions[0].status, "FAILED");
  });
});

describe("workflow SLA creation and breach evaluation", () => {
  test("MVP work-order and invoice events create timers", async () => {
    const repositories = makeExecutionRepositories();

    await createWorkflowSlaTimersFromEvent(
      makeEvent({
        newStatus: WORK_ORDER_STATUS.AwaitingQuote,
      }),
      repositories,
    );
    await createWorkflowSlaTimersFromEvent(
      makeEvent({
        newStatus: WORK_ORDER_STATUS.ReadyForInvoicing,
      }),
      repositories,
    );
    await createWorkflowSlaTimersFromEvent(
      makeEvent({
        lifecycle: "invoice",
        entityType: "invoice",
        newStatus: INVOICE_STATUS.Sent,
      }),
      repositories,
    );

    assert.deepEqual(
      repositories.timers.map((timer) => timer.slaKey),
      [
        "work-order.awaiting-quote",
        "work-order.invoicing",
        "invoice.payment-follow-up",
      ],
    );
  });

  test("due active timer becomes BREACHED while satisfied timer does not", async () => {
    const activeTimer = makeSlaTimer({
      timerId: "timer-1",
      dueAt: "2026-01-01T00:00:00.000Z",
      status: "ACTIVE",
    });
    const satisfiedTimer = makeSlaTimer({
      timerId: "timer-2",
      dueAt: "2026-01-01T00:00:00.000Z",
      status: "SATISFIED",
      satisfiedAt: "2026-01-01T00:05:00.000Z",
    });
    const repositories = makeExecutionRepositories({
      timers: [activeTimer, satisfiedTimer],
    });

    const result = await evaluateWorkflowSlaBreaches({
      now: "2026-01-02T00:00:00.000Z",
      adapters: repositories,
    });

    assert.equal(result.breachedCount, 1);
    assert.equal(repositories.timers[0].status, "BREACHED");
    assert.equal(repositories.timers[1].status, "SATISFIED");
    assert.equal(repositories.breaches.length, 1);
  });

  test("later transition event satisfies prior timer", async () => {
    const repositories = makeExecutionRepositories({
      timers: [
        makeSlaTimer({
          slaKey: "work-order.awaiting-client-approval",
          sourceStatus: WORK_ORDER_STATUS.AwaitingClientApproval,
        }),
      ],
    });

    const result = await satisfyWorkflowSlaTimersForEvent(
      makeEvent({
        entityId: "entity-1",
        previousStatus: WORK_ORDER_STATUS.AwaitingClientApproval,
        newStatus: WORK_ORDER_STATUS.ApprovedToProceed,
      }),
      repositories,
    );

    assert.equal(result.satisfiedCount, 1);
    assert.equal(repositories.timers[0].status, "SATISFIED");
  });
});

describe("workflow monitoring summary", () => {
  test("summary includes pending, failed, active, and breached counts", async () => {
    const repositories = makeExecutionRepositories({
      actions: [
        makeExecutionRecord({ actionId: "action-pending", status: "PENDING" }),
        makeExecutionRecord({ actionId: "action-failed", status: "FAILED" }),
      ],
      timers: [
        makeSlaTimer({ timerId: "timer-active", status: "ACTIVE" }),
        makeSlaTimer({ timerId: "timer-breached", status: "BREACHED" }),
      ],
      breaches: [makeBreachRecord({ breachId: "breach-1" })],
    });

    const summary = await buildWorkflowMonitoringSummary({
      now: "2026-01-02T00:00:00.000Z",
      adapters: repositories,
    });

    assert.equal(summary.pendingScheduledActionCount, 1);
    assert.equal(summary.failedScheduledActionCount, 1);
    assert.equal(summary.activeSlaCount, 1);
    assert.equal(summary.breachedSlaCount, 2);
    assert.equal(summary.breachedBySeverity.HIGH, 1);
  });
});

describe("workflow execution runtime integration", () => {
  test("successful work-order transition path creates SLA timers", async () => {
    const workOrder = makeWorkOrder({
      status: WORK_ORDER_STATUS.QaReview,
      quoteRequired: false,
    });
    const repositories = makeTransitionRepositories({ workOrder });

    const result = await applyWorkOrderTransition({
      lifecycle: "work-order",
      entityType: "work-order",
      entityId: workOrder.id,
      to: WORK_ORDER_STATUS.ReadyForInvoicing,
      actorType: "USER",
      role: PLATFORM_ROLES.Manager,
      repositories,
    });

    assert.equal(result.ok, true);
    assert.equal(repositories.timers.length, 1);
    assert.equal(repositories.timers[0].slaKey, "work-order.invoicing");
  });

  test("successful invoice transition path creates SLA timers", async () => {
    const workOrder = makeWorkOrder({ status: WORK_ORDER_STATUS.ReadyForInvoicing });
    const invoice = makeInvoice({
      status: INVOICE_STATUS.Draft,
      workOrderId: workOrder.id,
    });
    const repositories = makeTransitionRepositories({ workOrder, invoice });

    const result = await applyInvoiceTransition({
      lifecycle: "invoice",
      entityType: "invoice",
      entityId: invoice.id,
      to: INVOICE_STATUS.Sent,
      actorType: "USER",
      role: PLATFORM_ROLES.FinanceAdmin,
      repositories,
    });

    assert.equal(result.ok, true);
    assert.equal(repositories.timers.length, 1);
    assert.equal(repositories.timers[0].slaKey, "invoice.payment-follow-up");
  });

  test("failed transition path does not create timers", async () => {
    const workOrder = makeWorkOrder({
      status: WORK_ORDER_STATUS.New,
      quoteRequired: false,
    });
    const repositories = makeTransitionRepositories({ workOrder });

    const result = await applyWorkOrderTransition({
      lifecycle: "work-order",
      entityType: "work-order",
      entityId: workOrder.id,
      to: WORK_ORDER_STATUS.Triage,
      actorType: "USER",
      role: PLATFORM_ROLES.ClientUser,
      repositories,
    });

    assert.equal(result.ok, false);
    assert.equal(repositories.transitionEventRecords.length, 0);
    assert.equal(repositories.timers.length, 0);
  });
});

describe("quote execution and SLA posture", () => {
  test("quote SLA/runtime execution remains typed but deferred", async () => {
    assert.ok(
      WORKFLOW_SLA_DEFINITIONS.some(
        (definition) =>
          definition.lifecycle === "quote" &&
          definition.runtimePosture === "deferred",
      ),
    );

    const repositories = makeExecutionRepositories();
    const slaResult = await createWorkflowSlaTimersFromEvent(
      makeEvent({
        lifecycle: "quote",
        entityType: "quote",
        previousStatus: QUOTE_STATUS.ApprovedInternal,
        newStatus: QUOTE_STATUS.SentToClient,
      }),
      repositories,
    );

    const executionResult = await processScheduledWorkflowAction({
      record: makeExecutionRecord({ lifecycle: "quote", entityType: "quote" }),
      workerId: "worker-1",
      now: "2026-01-01T00:00:00.000Z",
      adapters: repositories,
    });

    assert.equal(slaResult.createdTimers.length, 0);
    assert.equal(slaResult.warnings[0].code, "WORKFLOW_SLA_QUOTE_RUNTIME_DEFERRED");
    assert.equal(executionResult.status, "SKIPPED");
    assert.equal(executionResult.failureCode, "QUOTE_RUNTIME_DEFERRED");
  });
});

function makeEvent(
  overrides: Partial<TransitionEventRecord>,
): TransitionEventRecord {
  const lifecycle = overrides.lifecycle ?? "work-order";
  const eventType =
    overrides.eventType ??
    (lifecycle === "invoice"
      ? "INVOICE_STATUS_CHANGED"
      : lifecycle === "quote"
        ? "QUOTE_STATUS_CHANGED"
        : "WORK_ORDER_STATUS_CHANGED");

  return {
    eventId: "event-1",
    eventType,
    lifecycle,
    entityType: lifecycle,
    entityId: "entity-1",
    previousStatus: WORK_ORDER_STATUS.New,
    newStatus: WORK_ORDER_STATUS.Triage,
    actorType: "USER",
    role: PLATFORM_ROLES.Coordinator,
    actorUserId: "user-1",
    timestamp: "2026-01-01T00:00:00.000Z",
    metadata: { correlationId: "corr-1" },
    source: "transition-service",
    version: 1,
    ...overrides,
  };
}

function makeExecutionRecord(
  overrides: Partial<ScheduledWorkflowExecutionRecord> = {},
): ScheduledWorkflowExecutionRecord {
  return {
    actionId: "action-1",
    ruleKey: "test.rule",
    lifecycle: "work-order",
    entityType: "work-order",
    entityId: "entity-1",
    actionType: "CREATE_FOLLOW_UP_TASK",
    status: "PENDING",
    scheduledFor: "2025-12-31T00:00:00.000Z",
    attemptCount: 0,
    message: "Create follow-up.",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeSlaTimer(overrides: Partial<WorkflowSlaTimer> = {}): WorkflowSlaTimer {
  return {
    timerId: "timer-1",
    lifecycle: "work-order",
    entityType: "work-order",
    entityId: "entity-1",
    slaKey: "work-order.awaiting-quote",
    startedAt: "2026-01-01T00:00:00.000Z",
    dueAt: "2026-01-02T00:00:00.000Z",
    satisfiedAt: null,
    status: "ACTIVE",
    breachSeverity: "HIGH",
    sourceStatus: WORK_ORDER_STATUS.AwaitingQuote,
    sourceEvent: "event-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeBreachRecord(
  overrides: Partial<WorkflowSlaBreachRecord> = {},
): WorkflowSlaBreachRecord {
  return {
    breachId: "breach-1",
    timerId: "timer-1",
    lifecycle: "work-order",
    entityType: "work-order",
    entityId: "entity-1",
    slaKey: "work-order.awaiting-quote",
    dueAt: "2026-01-01T00:00:00.000Z",
    breachedAt: "2026-01-02T00:00:00.000Z",
    severity: "HIGH",
    sourceEvent: "event-1",
    ...overrides,
  };
}

function makeExecutionRepositories(input: {
  readonly actions?: readonly ScheduledWorkflowExecutionRecord[];
  readonly attempts?: readonly WorkflowExecutionAttempt[];
  readonly timers?: readonly WorkflowSlaTimer[];
  readonly breaches?: readonly WorkflowSlaBreachRecord[];
  readonly failExecution?: boolean;
} = {}): WorkflowExecutionAdapters & {
  actions: ScheduledWorkflowExecutionRecord[];
  attempts: WorkflowExecutionAttempt[];
  timers: WorkflowSlaTimer[];
  breaches: WorkflowSlaBreachRecord[];
} {
  return {
    actions: [...(input.actions ?? [])],
    attempts: [...(input.attempts ?? [])],
    timers: [...(input.timers ?? [])],
    breaches: [...(input.breaches ?? [])],
    claimScheduledWorkflowExecutions({ workerId, now, limit }) {
      const current = new Date(now ?? new Date().toISOString()).getTime();
      const eligible = this.actions
        .filter(
          (action) =>
            (action.status === "PENDING" || action.status === "RETRY_SCHEDULED") &&
            (!action.scheduledFor || new Date(action.scheduledFor).getTime() <= current) &&
            (!action.nextRetryAt || new Date(action.nextRetryAt).getTime() <= current),
        )
        .slice(0, limit ?? 10);

      return eligible.map((action) => {
        const updated = {
          ...action,
          status: "CLAIMED" as ScheduledWorkflowExecutionStatus,
          claimedByWorkerId: workerId,
          claimedAt: now,
        };
        this.actions[this.actions.findIndex((candidate) => candidate.actionId === action.actionId)] =
          updated;
        return updated;
      });
    },
    getScheduledWorkflowExecutionById(actionId) {
      return this.actions.find((action) => action.actionId === actionId) ?? null;
    },
    updateScheduledWorkflowExecutionStatus(actionId, update) {
      const index = this.actions.findIndex((action) => action.actionId === actionId);
      if (index === -1) {
        throw new Error("action not found");
      }
      this.actions[index] = {
        ...this.actions[index],
        ...update,
        updatedAt: update.updatedAt,
      };
      return this.actions[index];
    },
    recordWorkflowExecutionAttempt(attempt) {
      this.attempts.push(attempt);
      return attempt;
    },
    executeScheduledWorkflowAction() {
      if (input.failExecution) {
        throw new Error("execution failed");
      }
    },
    recordWorkflowSlaTimer(timer) {
      this.timers.push(timer);
      return timer;
    },
    recordWorkflowSlaTimers(timers) {
      this.timers.push(...timers);
      return timers;
    },
    listActiveWorkflowSlaTimersDue({ now } = {}) {
      const current = new Date(now ?? new Date().toISOString()).getTime();
      return this.timers.filter(
        (timer) =>
          timer.status === "ACTIVE" &&
          !timer.satisfiedAt &&
          new Date(timer.dueAt).getTime() <= current,
      );
    },
    listActiveWorkflowSlaTimersForEntity(input) {
      return this.timers.filter(
        (timer) =>
          timer.status === "ACTIVE" &&
          timer.lifecycle === input.lifecycle &&
          timer.entityType === input.entityType &&
          timer.entityId === input.entityId,
      );
    },
    updateWorkflowSlaTimerStatus(timerId, update) {
      const index = this.timers.findIndex((timer) => timer.timerId === timerId);
      if (index === -1) {
        throw new Error("timer not found");
      }
      this.timers[index] = { ...this.timers[index], ...update };
      return this.timers[index];
    },
    recordWorkflowSlaBreach(breach) {
      this.breaches.push(breach);
      return breach;
    },
    listWorkflowExecutionsForMonitoring() {
      return this.actions;
    },
    listWorkflowSlaTimersForMonitoring() {
      return this.timers;
    },
    listWorkflowSlaBreachesForMonitoring() {
      return this.breaches;
    },
  };
}

function makeWorkOrder(
  overrides: Omit<Partial<WorkOrder>, "status"> & {
    readonly status?: WorkOrder["status"] | WorkOrderLifecycleStatus | string;
    readonly quoteRequired?: boolean;
    readonly quoteStatus?: string | null;
  } = {},
): WorkOrder & { quoteRequired?: boolean; quoteStatus?: string | null } {
  return {
    id: "wo-1",
    organizationId: "org-1",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    requestedByContactId: "contact-1",
    title: "Leaking pipe",
    description: "Pipe under sink is leaking",
    status: WORK_ORDER_STATUS.New as WorkOrder["status"],
    priority: "medium",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    ...overrides,
  } as WorkOrder & { quoteRequired?: boolean; quoteStatus?: string | null };
}

function makeInvoice(
  overrides: Omit<Partial<Invoice>, "status"> & {
    readonly status?: Invoice["status"] | InvoiceLifecycleStatus | string;
  } = {},
): Invoice {
  return {
    id: "invoice-1",
    organizationId: "org-1",
    workOrderId: "wo-1",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    status: INVOICE_STATUS.NotReady as Invoice["status"],
    currencyCode: "USD",
    subtotalAmountCents: 10000,
    totalAmountCents: 10000,
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    ...overrides,
  } as Invoice;
}

function makeTransitionRepositories(input: {
  readonly workOrder?: WorkOrder;
  readonly invoice?: Invoice;
} = {}): LifecycleTransitionRepositories & {
  transitionAuditRecords: TransitionAuditRecord[];
  transitionEventRecords: TransitionEventRecord[];
  timers: WorkflowSlaTimer[];
} {
  const executionRepositories = makeExecutionRepositories();
  return {
    ...executionRepositories,
    transitionAuditRecords: [],
    transitionEventRecords: [],
    getWorkOrderById: (entityId: string) =>
      input.workOrder?.id === entityId ? input.workOrder : null,
    updateWorkOrderStatus(entityId: string, nextStatus: WorkOrderLifecycleStatus) {
      if (!input.workOrder || input.workOrder.id !== entityId) {
        throw new Error("work order not found");
      }
      input.workOrder.status = nextStatus as WorkOrder["status"];
      return input.workOrder;
    },
    getInvoiceById: (entityId: string) =>
      input.invoice?.id === entityId ? input.invoice : null,
    updateInvoiceStatus(entityId: string, nextStatus: InvoiceLifecycleStatus) {
      if (!input.invoice || input.invoice.id !== entityId) {
        throw new Error("invoice not found");
      }
      input.invoice.status = nextStatus as Invoice["status"];
      return input.invoice;
    },
    recordTransitionAudit(record: TransitionAuditRecord) {
      this.transitionAuditRecords.push(record);
    },
    recordTransitionEvent(record: TransitionEventRecord) {
      this.transitionEventRecords.push(record);
    },
    recordWorkflowOrchestrationAction() {
      return undefined;
    },
  };
}
