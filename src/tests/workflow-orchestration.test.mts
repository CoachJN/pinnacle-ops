import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type {
  TransitionAuditRecord,
  TransitionEventRecord,
} from "../lib/workflows/audit/index.ts";
import {
  INVOICE_STATUS,
  QUOTE_STATUS,
  WORK_ORDER_STATUS,
  type InvoiceLifecycleStatus,
  type WorkOrderLifecycleStatus,
} from "../lib/workflows/lifecycle/index.ts";
import {
  evaluateInvoiceOrchestrationRules,
  evaluateQuoteOrchestrationRules,
  evaluateWorkOrderOrchestrationRules,
  handleWorkflowOrchestration,
  QUOTE_ORCHESTRATION_RULES,
  type WorkflowOrchestrationAction,
  type WorkflowOrchestrationRecord,
} from "../lib/workflows/orchestration/index.ts";
import { PLATFORM_ROLES } from "../lib/workflows/rbac-transition/index.ts";
import {
  applyInvoiceTransition,
  applyWorkOrderTransition,
  type LifecycleTransitionRepositories,
} from "../lib/workflows/transition-service/index.ts";
import type { Invoice } from "../types/financial.ts";
import type { WorkOrder } from "../types/work-order.ts";

describe("work-order orchestration rule evaluation", () => {
  test("AWAITING_QUOTE event creates quote follow-up actions", () => {
    const result = evaluateWorkOrderOrchestrationRules(
      makeEvent({
        previousStatus: WORK_ORDER_STATUS.QuotingRequired,
        newStatus: WORK_ORDER_STATUS.AwaitingQuote,
      }),
    );

    assert.equal(result.matchedRules.length, 1);
    assert.deepEqual(
      result.actions.map((action) => action.actionType),
      ["CREATE_FOLLOW_UP_TASK", "REQUEST_QUOTE_FOLLOW_UP"],
    );
    assert.equal(result.actions[1].status, "SCHEDULED");
  });

  test("AWAITING_CLIENT_APPROVAL event creates client approval and review actions", () => {
    const result = evaluateWorkOrderOrchestrationRules(
      makeEvent({
        previousStatus: WORK_ORDER_STATUS.QuoteReview,
        newStatus: WORK_ORDER_STATUS.AwaitingClientApproval,
      }),
    );

    assert.equal(result.matchedRules.length, 1);
    assert.deepEqual(
      result.actions.map((action) => action.actionType),
      [
        "CREATE_FOLLOW_UP_TASK",
        "REQUEST_CLIENT_APPROVAL_FOLLOW_UP",
        "REQUEST_INTERNAL_REVIEW",
      ],
    );
  });

  test("APPROVED_TO_PROCEED event creates scheduling actions", () => {
    const result = evaluateWorkOrderOrchestrationRules(
      makeEvent({
        previousStatus: WORK_ORDER_STATUS.AwaitingClientApproval,
        newStatus: WORK_ORDER_STATUS.ApprovedToProceed,
      }),
    );

    assert.equal(result.matchedRules.length, 1);
    assert.deepEqual(
      result.actions.map((action) => action.actionType),
      ["FLAG_ENTITY", "CREATE_FOLLOW_UP_TASK"],
    );
    assert.equal(result.actions[0].targetQueue, "scheduling");
  });

  test("READY_FOR_INVOICING event creates finance actions", () => {
    const result = evaluateWorkOrderOrchestrationRules(
      makeEvent({
        previousStatus: WORK_ORDER_STATUS.QaReview,
        newStatus: WORK_ORDER_STATUS.ReadyForInvoicing,
      }),
    );

    assert.equal(result.matchedRules.length, 1);
    assert.deepEqual(
      result.actions.map((action) => action.actionType),
      ["FLAG_ENTITY", "CREATE_FOLLOW_UP_TASK"],
    );
    assert.equal(result.actions[0].targetQueue, "finance-review");
  });
});

describe("invoice orchestration rule evaluation", () => {
  test("SENT event creates a scheduled payment recheck action", () => {
    const result = evaluateInvoiceOrchestrationRules(
      makeEvent({
        lifecycle: "invoice",
        entityType: "invoice",
        previousStatus: INVOICE_STATUS.Draft,
        newStatus: INVOICE_STATUS.Sent,
      }),
    );

    assert.equal(result.matchedRules.length, 1);
    assert.equal(result.actions.length, 1);
    assert.equal(result.actions[0].actionType, "SCHEDULE_RECHECK");
    assert.equal(result.actions[0].status, "SCHEDULED");
    assert.ok(result.actions[0].scheduledFor);
  });

  test("OVERDUE event creates escalation and collection review actions", () => {
    const result = evaluateInvoiceOrchestrationRules(
      makeEvent({
        lifecycle: "invoice",
        entityType: "invoice",
        previousStatus: INVOICE_STATUS.Sent,
        newStatus: INVOICE_STATUS.Overdue,
      }),
    );

    assert.equal(result.matchedRules.length, 1);
    assert.deepEqual(
      result.actions.map((action) => action.actionType),
      ["CREATE_ESCALATION_RECORD", "REQUEST_COLLECTION_REVIEW"],
    );
    assert.equal(result.actions[0].targetQueue, "collections-review");
  });
});

describe("workflow orchestration failure handling", () => {
  test("persistence failure yields warnings without failing the transition pipeline", async () => {
    const workOrder = makeWorkOrder({
      status: WORK_ORDER_STATUS.QaReview,
      quoteRequired: false,
    });
    const repositories = makeRepositories({
      workOrder,
      failOrchestrationWrites: true,
    });

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
    assert.equal(workOrder.status, WORK_ORDER_STATUS.ReadyForInvoicing);
    assert.equal(repositories.workflowOrchestrationRecords.length, 0);
    assert.ok(
      result.sideEffectWarnings?.some(
        (warning) => warning.code === "WORKFLOW_ORCHESTRATION_PERSISTENCE_FAILED",
      ),
    );
  });

  test("no orchestration actions are created for failed transitions", async () => {
    const workOrder = makeWorkOrder({
      status: WORK_ORDER_STATUS.New,
      quoteRequired: false,
    });
    const repositories = makeRepositories({ workOrder });

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
    assert.equal(repositories.workflowOrchestrationRecords.length, 0);
  });

  test("no orchestration actions are created when event logging is unavailable", async () => {
    const workOrder = makeWorkOrder({
      status: WORK_ORDER_STATUS.QaReview,
      quoteRequired: false,
    });
    const repositories = makeRepositories({
      workOrder,
      omitEventRecorder: true,
    });

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
    assert.equal(repositories.workflowOrchestrationRecords.length, 0);
    assert.equal(
      result.sideEffectWarnings?.[0].code,
      "TRANSITION_EVENT_LOG_UNAVAILABLE",
    );
  });

  test("handler skips when no reliable transition event is available", async () => {
    const repositories = makeRepositories();

    const result = await handleWorkflowOrchestration(null, repositories);

    assert.equal(result.matchedRuleCount, 0);
    assert.equal(result.createdActionCount, 0);
    assert.equal(repositories.workflowOrchestrationRecords.length, 0);
    assert.equal(result.warnings[0].code, "WORKFLOW_ORCHESTRATION_EVENT_UNAVAILABLE");
  });
});

describe("workflow orchestration runtime integration", () => {
  test("successful work-order transition path creates orchestration actions", async () => {
    const workOrder = makeWorkOrder({
      status: WORK_ORDER_STATUS.QaReview,
      quoteRequired: false,
    });
    const repositories = makeRepositories({ workOrder });

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
    assert.equal(repositories.workflowOrchestrationRecords.length, 2);
    assert.deepEqual(
      repositories.workflowOrchestrationRecords.map((record) => record.actionType),
      ["FLAG_ENTITY", "CREATE_FOLLOW_UP_TASK"],
    );
  });

  test("successful invoice transition path creates orchestration actions", async () => {
    const workOrder = makeWorkOrder({ status: WORK_ORDER_STATUS.ReadyForInvoicing });
    const invoice = makeInvoice({
      status: INVOICE_STATUS.Draft,
      workOrderId: workOrder.id,
    });
    const repositories = makeRepositories({ workOrder, invoice });

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
    assert.equal(repositories.workflowOrchestrationRecords.length, 1);
    assert.equal(
      repositories.workflowOrchestrationRecords[0].actionType,
      "SCHEDULE_RECHECK",
    );
    assert.equal(repositories.workflowOrchestrationRecords[0].status, "SCHEDULED");
  });
});

describe("quote orchestration posture", () => {
  test("quote rules are typed but runtime orchestration execution is deferred", () => {
    assert.ok(
      QUOTE_ORCHESTRATION_RULES.some(
        (rule) => rule.conditions.newStatus === QUOTE_STATUS.SentToClient,
      ),
    );
    assert.ok(QUOTE_ORCHESTRATION_RULES.every((rule) => rule.runtimeDeferred));

    const result = evaluateQuoteOrchestrationRules(
      makeEvent({
        lifecycle: "quote",
        entityType: "quote",
        previousStatus: QUOTE_STATUS.ApprovedInternal,
        newStatus: QUOTE_STATUS.SentToClient,
      }),
    );

    assert.equal(result.actions.length, 0);
    assert.equal(
      result.warnings[0].code,
      "WORKFLOW_ORCHESTRATION_QUOTE_RUNTIME_DEFERRED",
    );
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
    requestedByUserId: "user-1",
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

function makeRepositories(input: {
  readonly workOrder?: WorkOrder;
  readonly invoice?: Invoice;
  readonly failOrchestrationWrites?: boolean;
  readonly omitEventRecorder?: boolean;
} = {}): LifecycleTransitionRepositories & {
  updateWorkOrderStatusCalls: number;
  updateInvoiceStatusCalls: number;
  transitionAuditRecords: TransitionAuditRecord[];
  transitionEventRecords: TransitionEventRecord[];
  workflowOrchestrationRecords: WorkflowOrchestrationRecord[];
} {
  const repositories = {
    updateWorkOrderStatusCalls: 0,
    updateInvoiceStatusCalls: 0,
    transitionAuditRecords: [] as TransitionAuditRecord[],
    transitionEventRecords: [] as TransitionEventRecord[],
    workflowOrchestrationRecords: [] as WorkflowOrchestrationRecord[],
    getWorkOrderById: (entityId: string) =>
      input.workOrder?.id === entityId ? input.workOrder : null,
    updateWorkOrderStatus(entityId: string, nextStatus: WorkOrderLifecycleStatus) {
      this.updateWorkOrderStatusCalls += 1;
      if (!input.workOrder || input.workOrder.id !== entityId) {
        throw new Error("work order not found");
      }
      input.workOrder.status = nextStatus as WorkOrder["status"];
      return input.workOrder;
    },
    getInvoiceById: (entityId: string) =>
      input.invoice?.id === entityId ? input.invoice : null,
    updateInvoiceStatus(entityId: string, nextStatus: InvoiceLifecycleStatus) {
      this.updateInvoiceStatusCalls += 1;
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
    recordWorkflowOrchestrationAction(action: WorkflowOrchestrationAction) {
      if (input.failOrchestrationWrites) {
        throw new Error("orchestration write failed");
      }
      this.workflowOrchestrationRecords.push(action);
      return action;
    },
  };

  if (input.omitEventRecorder) {
    return {
      ...repositories,
      recordTransitionEvent: undefined,
    };
  }

  return repositories;
}
