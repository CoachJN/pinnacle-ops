import type {
  OptimizationPriorityTier,
} from "../optimization/index.ts";
import type { WorkflowVerificationAssertion, WorkflowVerificationFailure } from "./types.ts";

export function assertTransitionSucceeded(): WorkflowVerificationAssertion {
  return assertion("transition.succeeded", "Transition succeeded.", ({ step }) => {
    const result = step.actualOutcome.transitionResult;
    return result?.ok === true
      ? null
      : failure("TRANSITION_NOT_SUCCEEDED", "Expected transition to succeed.", {
          actual: result,
        });
  });
}

export function assertTransitionFailed(expectedFailureCode?: string): WorkflowVerificationAssertion {
  return assertion("transition.failed", "Transition failed as expected.", ({ step }) => {
    const result = step.actualOutcome.transitionResult;
    if (!result || result.ok) {
      return failure("TRANSITION_NOT_FAILED", "Expected transition to fail.", {
        actual: result,
      });
    }

    if (expectedFailureCode && result.failureCode !== expectedFailureCode) {
      return failure("TRANSITION_FAILURE_CODE_MISMATCH", "Transition failed with unexpected code.", {
        expectedFailureCode,
        actualFailureCode: result.failureCode,
      });
    }

    return null;
  });
}

export function assertAuditRecorded(input: { countAtLeast?: number; outcome?: string } = {}): WorkflowVerificationAssertion {
  return assertion("audit.recorded", "Transition audit was recorded.", ({ artifacts }) => {
    const matches = artifacts.transitionAudits.filter((record) =>
      input.outcome ? record.finalOutcome === input.outcome : true,
    );
    return matches.length >= (input.countAtLeast ?? 1)
      ? null
      : failure("AUDIT_NOT_RECORDED", "Expected audit record was not found.", {
          expectedOutcome: input.outcome,
          actualAuditCount: artifacts.auditCount,
        });
  });
}

export function assertEventRecorded(input: { eventType?: string; countAtLeast?: number } = {}): WorkflowVerificationAssertion {
  return assertion("event.recorded", "Transition event was recorded.", ({ artifacts }) => {
    const matches = artifacts.transitionEvents.filter((record) =>
      input.eventType ? record.eventType === input.eventType : true,
    );
    return matches.length >= (input.countAtLeast ?? 1)
      ? null
      : failure("EVENT_NOT_RECORDED", "Expected transition event was not found.", {
          expectedEventType: input.eventType,
          actualEventCount: artifacts.eventCount,
        });
  });
}

export function assertNoEventRecorded(): WorkflowVerificationAssertion {
  return assertion("event.not-recorded", "No success event was recorded.", ({ artifacts, step }) => {
    const result = step.actualOutcome.transitionResult;
    if (result?.ok === false) {
      const entityEvents = artifacts.transitionEvents.filter(
        (event) =>
          event.entityId === result.entityId &&
          event.previousStatus === result.from &&
          event.newStatus === result.to,
      );
      return entityEvents.length === 0
        ? null
        : failure("INVALID_EVENT_RECORDED", "Failed transition created a success event.", {
            entityEvents,
          });
    }

    return artifacts.eventCount === 0
      ? null
      : failure("UNEXPECTED_EVENT_RECORDED", "Unexpected transition event was recorded.", {
          eventCount: artifacts.eventCount,
        });
  });
}

export function assertReactionTriggered(type?: string): WorkflowVerificationAssertion {
  return assertion("reaction.triggered", "Reaction intent was triggered.", ({ artifacts }) => {
    const all = [...artifacts.notificationIntents, ...artifacts.automationIntents];
    const matches = type ? all.filter((intent) => intent.type === type) : all;
    return matches.length > 0
      ? null
      : failure("REACTION_NOT_TRIGGERED", "Expected reaction intent was not triggered.", {
          expectedType: type,
          reactionIntentCount: artifacts.reactionIntentCount,
        });
  });
}

export function assertNoReactionTriggered(): WorkflowVerificationAssertion {
  return assertion("reaction.not-triggered", "No reaction intent was triggered.", ({ artifacts, step }) => {
    const result = step.actualOutcome.transitionResult;
    const all = [...artifacts.notificationIntents, ...artifacts.automationIntents];

    if (result?.ok === false) {
      const scoped = all.filter(
        (intent) =>
          intent.entityId === result.entityId &&
          intent.previousStatus === result.from &&
          intent.newStatus === result.to,
      );
      return scoped.length === 0
        ? null
        : failure("UNEXPECTED_REACTION_TRIGGERED", "Failed transition triggered a reaction.", {
            scopedReactionIntentCount: scoped.length,
          });
    }

    return artifacts.reactionIntentCount === 0
      ? null
      : failure("UNEXPECTED_REACTION_TRIGGERED", "Unexpected reaction intent was triggered.", {
          reactionIntentCount: artifacts.reactionIntentCount,
        });
  });
}

export function assertOrchestrationCreated(actionType?: string): WorkflowVerificationAssertion {
  return assertion("orchestration.created", "Orchestration action was created.", ({ artifacts }) => {
    const matches = actionType
      ? artifacts.orchestrationActions.filter((action) => action.actionType === actionType)
      : artifacts.orchestrationActions;
    return matches.length > 0
      ? null
      : failure("ORCHESTRATION_NOT_CREATED", "Expected orchestration action was not created.", {
          expectedActionType: actionType,
          orchestrationActionCount: artifacts.orchestrationActionCount,
        });
  });
}

export function assertSlaTimerCreated(slaKey?: string): WorkflowVerificationAssertion {
  return assertion("sla.timer-created", "SLA timer was created.", ({ artifacts }) => {
    const matches = slaKey
      ? artifacts.slaTimers.filter((timer) => timer.slaKey === slaKey)
      : artifacts.slaTimers;
    return matches.length > 0
      ? null
      : failure("SLA_TIMER_NOT_CREATED", "Expected SLA timer was not created.", {
          expectedSlaKey: slaKey,
          slaTimerCount: artifacts.slaTimerCount,
        });
  });
}

export function assertSlaBreached(slaKey?: string): WorkflowVerificationAssertion {
  return assertion("sla.breached", "SLA breach was recorded.", ({ artifacts }) => {
    const matches = slaKey
      ? artifacts.slaBreaches.filter((breach) => breach.slaKey === slaKey)
      : artifacts.slaBreaches;
    return matches.length > 0
      ? null
      : failure("SLA_BREACH_NOT_RECORDED", "Expected SLA breach was not recorded.", {
          expectedSlaKey: slaKey,
          slaBreachCount: artifacts.slaBreachCount,
        });
  });
}

export function assertAvailableAction(actionCode: string): WorkflowVerificationAssertion {
  return assertion("action.available", "Action is available.", ({ artifacts }) => {
    const action = artifacts.actionAvailability
      .flatMap((result) => result.actions)
      .find((candidate) => candidate.actionCode === actionCode);
    return action?.allowed
      ? null
      : failure("ACTION_NOT_AVAILABLE", "Expected action was not available.", {
          actionCode,
          action,
        });
  });
}

export function assertBlockedAction(actionCode: string): WorkflowVerificationAssertion {
  return assertion("action.blocked", "Action is blocked.", ({ artifacts }) => {
    const action = artifacts.actionAvailability
      .flatMap((result) => result.actions)
      .find((candidate) => candidate.actionCode === actionCode);
    return action && !action.allowed
      ? null
      : failure("ACTION_NOT_BLOCKED", "Expected action was not blocked.", {
          actionCode,
          action,
        });
  });
}

export function assertPriorityTier(entityId: string, tier: OptimizationPriorityTier): WorkflowVerificationAssertion {
  return assertion("optimization.priority-tier", "Priority tier matches.", ({ artifacts }) => {
    const score = artifacts.priorityScores[entityId];
    return score?.tier === tier
      ? null
      : failure("PRIORITY_TIER_MISMATCH", "Priority tier did not match.", {
          entityId,
          expectedTier: tier,
          actualTier: score?.tier,
          score,
        });
  });
}

export function assertRecommendationPresent(entityId: string, actionCode: string): WorkflowVerificationAssertion {
  return assertion("optimization.recommendation-present", "Recommendation is present.", ({ artifacts }) => {
    const item = artifacts.optimizationQueue?.items.find((candidate) => candidate.entityId === entityId);
    const found = item?.nextActions.some((action) => action.actionCode === actionCode);
    return found
      ? null
      : failure("RECOMMENDATION_NOT_FOUND", "Expected recommendation was not found.", {
          entityId,
          actionCode,
          recommendations: item?.nextActions,
        });
  });
}

export function assertQueueOrder(expectedEntityIds: readonly string[]): WorkflowVerificationAssertion {
  return assertion("optimization.queue-order", "Queue order matches.", ({ artifacts }) => {
    const actual = artifacts.optimizationQueue?.items.map((item) => item.entityId) ?? [];
    const expectedPrefix = expectedEntityIds.join("|");
    const actualPrefix = actual.slice(0, expectedEntityIds.length).join("|");
    return actualPrefix === expectedPrefix
      ? null
      : failure("QUEUE_ORDER_MISMATCH", "Optimized queue order did not match.", {
          expectedEntityIds,
          actualEntityIds: actual,
        });
  });
}

export function assertMonitoringSummary(input: {
  failedScheduledActionCount?: number;
  breachedSlaCount?: number;
}): WorkflowVerificationAssertion {
  return assertion("monitoring.summary", "Monitoring summary matches.", ({ artifacts }) => {
    const summary = artifacts.monitoringSummary;
    if (!summary) {
      return failure("MONITORING_SUMMARY_MISSING", "Expected monitoring summary was missing.");
    }

    if (
      input.failedScheduledActionCount != null &&
      summary.failedScheduledActionCount < input.failedScheduledActionCount
    ) {
      return failure("MONITORING_FAILED_COUNT_MISMATCH", "Failed scheduled action count was too low.", {
        expectedAtLeast: input.failedScheduledActionCount,
        actual: summary.failedScheduledActionCount,
      });
    }

    if (
      input.breachedSlaCount != null &&
      summary.breachedSlaCount < input.breachedSlaCount
    ) {
      return failure("MONITORING_BREACH_COUNT_MISMATCH", "Breached SLA count was too low.", {
        expectedAtLeast: input.breachedSlaCount,
        actual: summary.breachedSlaCount,
      });
    }

    return null;
  });
}

function assertion(
  assertionKey: string,
  description: string,
  evaluate: WorkflowVerificationAssertion["evaluate"],
): WorkflowVerificationAssertion {
  return { assertionKey, description, evaluate };
}

function failure(
  code: string,
  message: string,
  diagnostics: Readonly<Record<string, unknown>> = {},
): WorkflowVerificationFailure {
  return { code, message, diagnostics };
}
