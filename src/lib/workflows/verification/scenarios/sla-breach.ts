import {
  assertMonitoringSummary,
  assertSlaBreached,
} from "../assertions.ts";
import {
  evaluateSlaBreachesStep,
  makeScenario,
  monitoringSummaryStep,
  processOneScheduledActionStep,
} from "./helpers.ts";

export const slaBreachScenario = makeScenario({
  scenarioKey: "sla-breach",
  scenarioName: "SLA Breach And Scheduled Execution",
  seed(env) {
    env.scheduledWorkflowActions.push({
      actionId: "scheduled-retry",
      ruleKey: "verification.retry",
      lifecycle: "work-order",
      entityType: "work-order",
      entityId: "wo-retry",
      actionType: "CREATE_FOLLOW_UP_TASK",
      status: "PENDING",
      scheduledFor: env.clock.now(),
      attemptCount: 0,
      maxAttempts: 3,
      message: "Retryable verification action.",
      createdAt: env.clock.now(),
      updatedAt: env.clock.now(),
    });
    env.scheduledWorkflowActions.push({
      actionId: "scheduled-fail",
      ruleKey: "verification.fail",
      lifecycle: "work-order",
      entityType: "work-order",
      entityId: "wo-fail",
      actionType: "CREATE_FOLLOW_UP_TASK",
      status: "PENDING",
      scheduledFor: env.clock.now(),
      attemptCount: 2,
      maxAttempts: 3,
      message: "Max retry verification action.",
      createdAt: env.clock.now(),
      updatedAt: env.clock.now(),
    });
    env.workflowSlaTimers.push({
      timerId: "timer-due",
      lifecycle: "work-order",
      entityType: "work-order",
      entityId: "wo-sla",
      slaKey: "work-order.scheduling",
      startedAt: "2026-01-01T00:00:00.000Z",
      dueAt: "2026-01-01T00:00:00.000Z",
      satisfiedAt: null,
      status: "ACTIVE",
      breachSeverity: "HIGH",
      sourceStatus: "APPROVED_TO_PROCEED",
      sourceEvent: "event-sla",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
  },
  steps: [
    processOneScheduledActionStep({
      stepKey: "retryable-failure",
      failExecution: true,
      action: (env) => env.scheduledWorkflowActions.find((action) => action.actionId === "scheduled-retry")!,
    }),
    processOneScheduledActionStep({
      stepKey: "max-retries-failed",
      failExecution: true,
      action: (env) => env.scheduledWorkflowActions.find((action) => action.actionId === "scheduled-fail")!,
    }),
    evaluateSlaBreachesStep({
      stepKey: "due-sla-breached",
      advanceHours: 1,
      assertions: [assertSlaBreached("work-order.scheduling")],
    }),
    monitoringSummaryStep({
      assertions: [
        assertMonitoringSummary({
          failedScheduledActionCount: 1,
          breachedSlaCount: 1,
        }),
      ],
    }),
  ],
});
