import {
  assertBlockedAction,
  assertPriorityTier,
  assertQueueOrder,
  assertRecommendationPresent,
} from "../assertions.ts";
import {
  INVOICE_STATUS,
  PLATFORM_ROLES,
  WORK_ORDER_STATUS,
  actionAvailabilityStep,
  makeScenario,
  optimizationStep,
} from "./helpers.ts";

export const optimizationRankingScenario = makeScenario({
  scenarioKey: "optimization-ranking",
  scenarioName: "Optimization Priority Ranking",
  seed(env) {
    env.seedWorkOrder({
      id: "wo-low",
      status: WORK_ORDER_STATUS.New,
      quoteRequired: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    env.seedWorkOrder({
      id: "wo-scheduling",
      status: WORK_ORDER_STATUS.ApprovedToProceed,
      quoteRequired: false,
      updatedAt: "2025-12-25T00:00:00.000Z",
    });
    env.seedWorkOrder({
      id: "wo-escalated",
      status: WORK_ORDER_STATUS.Escalated,
      quoteRequired: false,
      updatedAt: "2025-12-25T00:00:00.000Z",
    });
    env.seedInvoice({
      id: "invoice-overdue",
      workOrderId: "wo-low",
      status: INVOICE_STATUS.Overdue,
      dueDate: "2025-12-20T00:00:00.000Z",
    });
    env.workflowSlaTimers.push({
      timerId: "timer-critical-invoice",
      lifecycle: "invoice",
      entityType: "invoice",
      entityId: "invoice-overdue",
      slaKey: "invoice.overdue-collection",
      startedAt: "2025-12-20T00:00:00.000Z",
      dueAt: "2025-12-21T00:00:00.000Z",
      satisfiedAt: null,
      status: "BREACHED",
      breachSeverity: "CRITICAL",
      sourceStatus: INVOICE_STATUS.Overdue,
      createdAt: "2025-12-20T00:00:00.000Z",
    });
  },
  steps: [
    actionAvailabilityStep({
      stepKey: "blocked-action-availability",
      lifecycle: "work-order",
      entityId: "wo-scheduling",
      role: PLATFORM_ROLES.ClientUser,
      assertions: [assertBlockedAction("move_to_scheduling")],
    }),
    optimizationStep({
      assertions: [
        assertPriorityTier("invoice-overdue", "CRITICAL"),
        assertRecommendationPresent("wo-scheduling", "move_to_scheduling"),
        assertQueueOrder(["invoice-overdue"]),
      ],
    }),
  ],
});
