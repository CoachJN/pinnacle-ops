import "server-only";

import {
  RUNTIME_ALERT_STATUSES,
  RUNTIME_ALERT_TYPES,
  type RuntimeAlert,
} from "../domain/runtime-alert";
import type { RuntimeProjection } from "../domain/runtime-projection";
import type { RuntimeObservabilityRepositories } from "./runtime-observability-repository";

export interface RuntimeAlertService {
  sync(input: {
    projection: RuntimeProjection;
    now: string;
  }): Promise<readonly RuntimeAlert[]>;
  listActive(input: {
    organizationId: string;
    limit?: number;
  }): Promise<readonly RuntimeAlert[]>;
}

export function createRuntimeAlertService(
  repositories: RuntimeObservabilityRepositories,
): RuntimeAlertService {
  return {
    async sync(input) {
      const desired = buildDesiredAlerts(input.projection, input.now);
      const touchedDedupKeys = new Set<string>();
      const persisted: RuntimeAlert[] = [];

      for (const alert of desired) {
        touchedDedupKeys.add(alert.dedupKey);
        const existing = await repositories.alerts.findByDedupKey({
          organizationId: input.projection.organizationId,
          dedupKey: alert.dedupKey,
        });
        if (!existing) {
          persisted.push(await repositories.alerts.create(alert));
          continue;
        }

        const next: RuntimeAlert = {
          ...existing,
          status: RUNTIME_ALERT_STATUSES.Active,
          severity: alert.severity,
          summary: alert.summary,
          metricValue: alert.metricValue,
          threshold: alert.threshold,
          correlationId: alert.correlationId,
          causationId: alert.causationId,
          metadata: alert.metadata,
          lastDetectedAt: input.now,
          resolvedAt: null,
          updatedAt: input.now,
        };
        persisted.push(await repositories.alerts.save(next));
      }

      const existingAlerts = await repositories.alerts.listByOrganizationId({
        organizationId: input.projection.organizationId,
        limit: 200,
      });
      for (const existing of existingAlerts) {
        if (
          existing.status === RUNTIME_ALERT_STATUSES.Active &&
          !touchedDedupKeys.has(existing.dedupKey)
        ) {
          await repositories.alerts.save({
            ...existing,
            status: RUNTIME_ALERT_STATUSES.Resolved,
            resolvedAt: input.now,
            updatedAt: input.now,
          });
        }
      }

      return repositories.alerts.listByOrganizationId({
        organizationId: input.projection.organizationId,
        status: RUNTIME_ALERT_STATUSES.Active,
        limit: 100,
      });
    },
    listActive(input) {
      return repositories.alerts.listByOrganizationId({
        organizationId: input.organizationId,
        status: RUNTIME_ALERT_STATUSES.Active,
        limit: input.limit ?? 100,
      });
    },
  };
}

function buildDesiredAlerts(
  projection: RuntimeProjection,
  now: string,
): RuntimeAlert[] {
  const base = {
    organizationId: projection.organizationId,
    tenantId: projection.tenantId,
    correlationId: `runtime-alert:${projection.organizationId}:${now}`,
    sourceEventId: null,
    firstDetectedAt: now,
    lastDetectedAt: now,
    createdAt: now,
    updatedAt: now,
    resolvedAt: null,
  } as const;

  return [
    projection.totals.deadLetterCount >= 3
      ? alertFromProjection(base, {
          dedupKey: `${RUNTIME_ALERT_TYPES.ExcessiveDeadLetters}:${projection.organizationId}`,
          alertType: RUNTIME_ALERT_TYPES.ExcessiveDeadLetters,
          severity: projection.totals.deadLetterCount >= 5 ? "critical" : "warning",
          summary: "Dead-letter volume exceeded the safe runtime threshold.",
          metricValue: projection.totals.deadLetterCount,
          threshold: 3,
        })
      : null,
    projection.queue.expiredLeaseCount >= 1
      ? alertFromProjection(base, {
          dedupKey: `${RUNTIME_ALERT_TYPES.StuckRuntimeJobs}:${projection.organizationId}`,
          alertType: RUNTIME_ALERT_TYPES.StuckRuntimeJobs,
          severity: projection.queue.expiredLeaseCount >= 3 ? "critical" : "warning",
          summary: "Runtime jobs are stuck with expired leases or running beyond their lease.",
          metricValue: projection.queue.expiredLeaseCount,
          threshold: 1,
        })
      : null,
    projection.totals.overdueSlaTimerCount >= 1
      ? alertFromProjection(base, {
          dedupKey: `${RUNTIME_ALERT_TYPES.OverdueSlaEvaluations}:${projection.organizationId}`,
          alertType: RUNTIME_ALERT_TYPES.OverdueSlaEvaluations,
          severity: projection.totals.overdueSlaTimerCount >= 3 ? "critical" : "warning",
          summary: "SLA evaluations are overdue and require operator attention.",
          metricValue: projection.totals.overdueSlaTimerCount,
          threshold: 1,
        })
      : null,
    projection.trends.replayBacklogDelta > 0 && projection.replay.replayBacklogCount > 0
      ? alertFromProjection(base, {
          dedupKey: `${RUNTIME_ALERT_TYPES.ReplayBacklogGrowth}:${projection.organizationId}`,
          alertType: RUNTIME_ALERT_TYPES.ReplayBacklogGrowth,
          severity: projection.replay.replayBacklogCount >= 5 ? "critical" : "warning",
          summary: "Replay backlog is growing between projection refreshes.",
          metricValue: projection.replay.replayBacklogCount,
          threshold: 1,
        })
      : null,
    projection.replay.failedProviderReceipts >= 1
      ? alertFromProjection(base, {
          dedupKey: `${RUNTIME_ALERT_TYPES.ProviderReconciliationFailures}:${projection.organizationId}`,
          alertType: RUNTIME_ALERT_TYPES.ProviderReconciliationFailures,
          severity: projection.replay.failedProviderReceipts >= 5 ? "critical" : "warning",
          summary: "Provider reconciliation failures require explicit retry or investigation.",
          metricValue: projection.replay.failedProviderReceipts,
          threshold: 1,
        })
      : null,
    projection.totals.failedTransportAttemptCount >= 3
      ? alertFromProjection(base, {
          dedupKey: `${RUNTIME_ALERT_TYPES.RepeatedTransportFailures}:${projection.organizationId}`,
          alertType: RUNTIME_ALERT_TYPES.RepeatedTransportFailures,
          severity: projection.totals.failedTransportAttemptCount >= 5 ? "critical" : "warning",
          summary: "Transport failures exceeded the repeated-failure threshold.",
          metricValue: projection.totals.failedTransportAttemptCount,
          threshold: 3,
        })
      : null,
    projection.queue.queueLagMs >= 15 * 60 * 1000
      ? alertFromProjection(base, {
          dedupKey: `${RUNTIME_ALERT_TYPES.QueueStarvation}:${projection.organizationId}`,
          alertType: RUNTIME_ALERT_TYPES.QueueStarvation,
          severity: projection.queue.queueLagMs >= 30 * 60 * 1000 ? "critical" : "warning",
          summary: "Queue lag indicates runtime starvation or insufficient worker capacity.",
          metricValue: projection.queue.queueLagMs,
          threshold: 15 * 60 * 1000,
        })
      : null,
    projection.queue.retryStormCount >= 5
      ? alertFromProjection(base, {
          dedupKey: `${RUNTIME_ALERT_TYPES.ExcessiveRetryChurn}:${projection.organizationId}`,
          alertType: RUNTIME_ALERT_TYPES.ExcessiveRetryChurn,
          severity: projection.queue.retryStormCount >= 10 ? "critical" : "warning",
          summary: "Retry churn exceeded the safe operational threshold.",
          metricValue: projection.queue.retryStormCount,
          threshold: 5,
        })
      : null,
  ].filter((item): item is RuntimeAlert => item !== null);
}

function alertFromProjection(
  base: {
    organizationId: string;
    tenantId: string;
    correlationId: string;
    sourceEventId: null;
    firstDetectedAt: string;
    lastDetectedAt: string;
    createdAt: string;
    updatedAt: string;
    resolvedAt: null;
  },
  input: {
    dedupKey: string;
    alertType: RuntimeAlert["alertType"];
    severity: RuntimeAlert["severity"];
    summary: string;
    metricValue: number;
    threshold: number;
  },
): RuntimeAlert {
  return {
    id: `${input.dedupKey}:${base.updatedAt}`,
    ...base,
    dedupKey: input.dedupKey,
    alertType: input.alertType,
    severity: input.severity,
    status: RUNTIME_ALERT_STATUSES.Active,
    summary: input.summary,
    metricValue: input.metricValue,
    threshold: input.threshold,
    causationId: input.dedupKey,
    metadata: {
      metricValue: input.metricValue,
      threshold: input.threshold,
    },
  };
}
