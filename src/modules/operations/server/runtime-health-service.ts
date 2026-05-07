import "server-only";

import {
  RUNTIME_HEALTH_STATUSES,
  type RuntimeHealth,
  type RuntimeHealthIndicator,
} from "../domain/runtime-health";
import type { RuntimeProjection } from "../domain/runtime-projection";

export interface RuntimeHealthService {
  evaluate(input: {
    projection: RuntimeProjection;
    now: string;
  }): RuntimeHealth;
}

export function createRuntimeHealthService(): RuntimeHealthService {
  return {
    evaluate(input) {
      const indicators: RuntimeHealthIndicator[] = [];
      pushIndicator(indicators, {
        breached: input.projection.totals.deadLetterCount >= 5,
        code: "dead_letters_critical",
        severity: "critical",
        message: "Dead letters exceeded the critical threshold.",
        metricValue: input.projection.totals.deadLetterCount,
        threshold: 5,
      });
      pushIndicator(indicators, {
        breached: input.projection.queue.expiredLeaseCount >= 3,
        code: "stuck_runtime_jobs",
        severity: "critical",
        message: "Multiple runtime jobs have expired leases or stuck execution.",
        metricValue: input.projection.queue.expiredLeaseCount,
        threshold: 3,
      });
      pushIndicator(indicators, {
        breached: input.projection.queue.overdueQueuedCount >= 5,
        code: "overdue_runtime_jobs",
        severity: "warning",
        message: "Queued runtime jobs are overdue for execution.",
        metricValue: input.projection.queue.overdueQueuedCount,
        threshold: 5,
      });
      pushIndicator(indicators, {
        breached: input.projection.totals.overdueSlaTimerCount >= 3,
        code: "overdue_sla_evaluations",
        severity: "warning",
        message: "SLA evaluations are overdue.",
        metricValue: input.projection.totals.overdueSlaTimerCount,
        threshold: 3,
      });
      pushIndicator(indicators, {
        breached: input.projection.replay.replayBacklogCount >= 5,
        code: "replay_backlog",
        severity: "warning",
        message: "Replay backlog requires operator review.",
        metricValue: input.projection.replay.replayBacklogCount,
        threshold: 5,
      });
      pushIndicator(indicators, {
        breached: input.projection.replay.failedProviderReceipts >= 5,
        code: "provider_reconciliation_failures",
        severity: "critical",
        message: "Provider reconciliation failures exceeded the safe threshold.",
        metricValue: input.projection.replay.failedProviderReceipts,
        threshold: 5,
      });
      pushIndicator(indicators, {
        breached: input.projection.queue.retryStormCount >= 10,
        code: "retry_storm",
        severity: "critical",
        message: "Retry churn indicates a runtime storm.",
        metricValue: input.projection.queue.retryStormCount,
        threshold: 10,
      });
      pushIndicator(indicators, {
        breached: input.projection.queue.queueLagMs >= 30 * 60 * 1000,
        code: "queue_starvation",
        severity: "critical",
        message: "Queue lag exceeded the starvation threshold.",
        metricValue: input.projection.queue.queueLagMs,
        threshold: 30 * 60 * 1000,
      });

      const status =
        indicators.some((item) => item.severity === "critical")
          ? RUNTIME_HEALTH_STATUSES.Critical
          : indicators.length > 0
            ? RUNTIME_HEALTH_STATUSES.Degraded
            : RUNTIME_HEALTH_STATUSES.Healthy;

      return {
        status,
        evaluatedAt: input.now,
        indicators,
      };
    },
  };
}

function pushIndicator(
  indicators: RuntimeHealthIndicator[],
  input: RuntimeHealthIndicator & { breached: boolean },
): void {
  if (!input.breached) {
    return;
  }
  indicators.push({
    code: input.code,
    severity: input.severity,
    message: input.message,
    metricValue: input.metricValue,
    threshold: input.threshold,
  });
}
