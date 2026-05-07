import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildOptimizedWorkQueue,
  buildWorkflowOperationalInsights,
  computeWorkflowPriorityScore,
  detectWorkflowRiskSignals,
  recommendAssignment,
  recommendNextWorkflowActions,
  type WorkflowOptimizationContext,
} from "../lib/workflows/optimization/index.ts";
import {
  INVOICE_STATUS,
  QUOTE_STATUS,
  WORK_ORDER_STATUS,
} from "../lib/workflows/lifecycle/index.ts";
import { PLATFORM_ROLES } from "../lib/workflows/rbac-transition/index.ts";
import type { WorkflowSlaTimer } from "../lib/workflows/execution/index.ts";
import type { ClientInvoice as Invoice } from "../types/invoice.ts";
import type { WorkOrder } from "../types/work-order.ts";

const now = "2026-01-10T00:00:00.000Z";

describe("workflow priority scoring", () => {
  test("SLA breach produces CRITICAL priority", () => {
    const score = computeWorkflowPriorityScore(
      makeContext({
        slaTimers: [
          makeSlaTimer({ status: "BREACHED", breachSeverity: "CRITICAL" }),
        ],
      }),
    );

    assert.equal(score.tier, "CRITICAL");
    assert.equal(
      score.contributingFactors.some((factor) => factor.code === "sla.breached"),
      true,
    );
  });

  test("overdue invoice produces HIGH priority", () => {
    const score = computeWorkflowPriorityScore(
      makeInvoiceContext({
        entity: makeInvoice({
          status: INVOICE_STATUS.Overdue as Invoice["status"],
          dueDate: "2026-01-01T00:00:00.000Z",
        }),
      }),
    );

    assert.equal(score.tier === "HIGH" || score.tier === "CRITICAL", true);
    assert.equal(
      score.contributingFactors.some((factor) => factor.code === "invoice.overdue"),
      true,
    );
  });

  test("low-risk item stays LOW", () => {
    const score = computeWorkflowPriorityScore(
      makeContext({
        entity: makeWorkOrder({
          status: WORK_ORDER_STATUS.New as WorkOrder["status"],
          updatedAt: "2026-01-09T23:00:00.000Z",
        }),
      }),
    );

    assert.equal(score.tier, "LOW");
  });
});

describe("workflow risk detection", () => {
  test("detects breached SLA", () => {
    const risks = detectWorkflowRiskSignals(
      makeContext({
        slaTimers: [makeSlaTimer({ status: "BREACHED" })],
      }),
    );

    assert.equal(risks.some((risk) => risk.type === "SLA_BREACHED"), true);
  });

  test("detects overdue invoice", () => {
    const risks = detectWorkflowRiskSignals(
      makeInvoiceContext({
        entity: makeInvoice({
          status: INVOICE_STATUS.Sent as Invoice["status"],
          dueDate: "2026-01-01T00:00:00.000Z",
        }),
      }),
    );

    assert.equal(risks.some((risk) => risk.type === "INVOICE_OVERDUE"), true);
  });

  test("does not create risk false positives for fresh active work", () => {
    const risks = detectWorkflowRiskSignals(
      makeContext({
        entity: makeWorkOrder({
          status: WORK_ORDER_STATUS.New as WorkOrder["status"],
          updatedAt: "2026-01-09T23:00:00.000Z",
        }),
      }),
    );

    assert.deepEqual(risks, []);
  });
});

describe("workflow assignment recommendations", () => {
  test("returns role-based recommendation when no agent pool exists", () => {
    const recommendation = recommendAssignment(
      makeContext({
        entity: makeWorkOrder({
          status: WORK_ORDER_STATUS.ReadyForInvoicing as WorkOrder["status"],
        }),
      }),
    );

    assert.equal(recommendation.recommendedRole, PLATFORM_ROLES.FinanceAdmin);
    assert.equal(recommendation.recommendedAgentId, undefined);
  });

  test("selects least loaded matching agent when agent data exists", () => {
    const recommendation = recommendAssignment(makeInvoiceContext(), [
      {
        agentId: "agent-busy",
        roles: [PLATFORM_ROLES.FinanceAdmin],
        activeWorkCount: 10,
      },
      {
        agentId: "agent-light",
        roles: [PLATFORM_ROLES.FinanceAdmin],
        activeWorkCount: 1,
      },
    ]);

    assert.equal(recommendation.recommendedAgentId, "agent-light");
  });
});

describe("workflow next action recommendations", () => {
  test("suggests correct action by status", () => {
    const recommendations = recommendNextWorkflowActions(
      makeContext({
        entity: makeWorkOrder({
          status: WORK_ORDER_STATUS.ApprovedToProceed as WorkOrder["status"],
        }),
      }),
    );

    assert.equal(recommendations[0].actionCode, "move_to_scheduling");
  });

  test("does not suggest blocked action when action availability is supplied", () => {
    const recommendations = recommendNextWorkflowActions(
      makeContext({
        entity: makeWorkOrder({
          status: WORK_ORDER_STATUS.ApprovedToProceed as WorkOrder["status"],
        }),
        actionAvailability: {
          ok: true,
          supported: true,
          lifecycle: "work-order",
          entityType: "work-order",
          entityId: "wo-1",
          actions: [
            {
              actionCode: "move_to_scheduling",
              lifecycle: "work-order",
              entityType: "work-order",
              fromStatus: WORK_ORDER_STATUS.ApprovedToProceed,
              toStatus: WORK_ORDER_STATUS.Scheduling,
              label: "Move to scheduling",
              actorType: "USER",
              role: PLATFORM_ROLES.Coordinator,
              allowed: false,
              blockReasonCode: "ROLE_NOT_PERMITTED",
              message: "Blocked for test.",
            },
          ],
          message: "Evaluated.",
        },
      }),
    );

    assert.equal(
      recommendations.some((item) => item.actionCode === "move_to_scheduling"),
      false,
    );
  });
});

describe("optimized work queue", () => {
  test("sorts items by priority and assigns priority tiers", () => {
    const queue = buildOptimizedWorkQueue({
      now,
      entities: [
        makeContext({
          entityId: "low",
          entity: makeWorkOrder({
            id: "low",
            status: WORK_ORDER_STATUS.New as WorkOrder["status"],
            updatedAt: "2026-01-09T23:00:00.000Z",
          }),
        }),
        makeInvoiceContext({
          entityId: "high",
          entity: makeInvoice({
            id: "high",
            status: INVOICE_STATUS.Overdue as Invoice["status"],
          }),
        }),
      ],
    });

    assert.equal(queue.items[0].entityId, "high");
    assert.equal(queue.groupedByPriority.CRITICAL.length, 1);
    assert.equal(queue.groupedByPriority.LOW.length, 1);
  });
});

describe("workflow operational insights", () => {
  test("aggregates counts from optimized queue", () => {
    const insights = buildWorkflowOperationalInsights({
      now,
      entities: [
        makeContext({
          slaTimers: [makeSlaTimer({ status: "BREACHED" })],
        }),
        makeInvoiceContext({
          entityId: "invoice-overdue",
          entity: makeInvoice({
            id: "invoice-overdue",
            status: INVOICE_STATUS.Overdue as Invoice["status"],
          }),
        }),
      ],
    });

    assert.equal(insights.totalActiveWork, 2);
    assert.equal(insights.breachedSlaCount, 1);
    assert.equal(insights.overdueInvoiceCount, 1);
    assert.equal(insights.highRiskWorkCount, 2);
  });
});

describe("quote optimization posture", () => {
  test("quote recommendations remain deferred and non-active", () => {
    const recommendations = recommendNextWorkflowActions({
      lifecycle: "quote",
      entityType: "quote",
      entityId: "quote-1",
      status: QUOTE_STATUS.Requested,
      entity: {
        id: "quote-1",
        status: QUOTE_STATUS.Requested,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
      now,
      quoteRuntimePosture: "deferred",
    });

    assert.equal(recommendations.length, 1);
    assert.equal(recommendations[0].actionCode, "quote_runtime_deferred");
    assert.equal(recommendations[0].runtimePosture, "deferred");
  });
});

function makeContext(
  overrides: Partial<WorkflowOptimizationContext> = {},
): WorkflowOptimizationContext {
  const entity =
    (overrides.entity as WorkOrder | undefined) ??
    makeWorkOrder({
      id: overrides.entityId ?? "wo-1",
      status: WORK_ORDER_STATUS.Triage as WorkOrder["status"],
    });

  return {
    lifecycle: "work-order",
    entityType: "work-order",
    entityId: entity.id,
    status: entity.status,
    entity,
    now,
    ...overrides,
  };
}

function makeInvoiceContext(
  overrides: Partial<WorkflowOptimizationContext> = {},
): WorkflowOptimizationContext {
  const entity =
    (overrides.entity as Invoice | undefined) ??
    makeInvoice({
      id: overrides.entityId ?? "invoice-1",
      status: INVOICE_STATUS.Draft as Invoice["status"],
    });

  return {
    lifecycle: "invoice",
    entityType: "invoice",
    entityId: entity.id,
    status: entity.status,
    entity,
    now,
    ...overrides,
  };
}

function makeWorkOrder(overrides: Partial<WorkOrder> = {}): WorkOrder {
  return {
    id: "wo-1",
    workOrderNumber: "WO-1001",
    organizationId: "org-1",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    shortDescription: "Leaking pipe",
    description: "Pipe under sink is leaking",
    lifecycleStatus: WORK_ORDER_STATUS.New as WorkOrder["lifecycleStatus"],
    status: WORK_ORDER_STATUS.New as WorkOrder["status"],
    priority: "medium",
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: "invoice-1",
    organizationId: "org-1",
    workOrderId: "wo-1",
    clientOrganizationId: "client-1",
    locationId: "loc-1",
    invoiceNumber: "INV-1",
    lineItems: [
      {
        id: "line-1",
        description: "Optimization test invoice line",
        quantity: 1,
        unitPrice: 100,
        lineTotal: 100,
      },
    ],
    subtotal: 100,
    taxAmount: 0,
    totalAmount: 100,
    currency: "USD",
    status: INVOICE_STATUS.NotReady as Invoice["status"],
    issuedDate: null,
    dueDate: "2026-01-05",
    sentAt: null,
    viewedAt: null,
    paidAt: null,
    voidedAt: null,
    paymentReference: null,
    notes: null,
    qboInvoiceId: null,
    qboSyncStatus: null,
    recordStatus: "active",
    isDeleted: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdByUserId: "user-1",
    updatedByUserId: "user-1",
    ...overrides,
  };
}

function makeSlaTimer(overrides: Partial<WorkflowSlaTimer> = {}): WorkflowSlaTimer {
  return {
    timerId: "timer-1",
    lifecycle: "work-order",
    entityType: "work-order",
    entityId: "wo-1",
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
