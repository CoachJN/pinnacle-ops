import "server-only";

import type { FirestoreRepositories } from "@/server/repositories";
import type { ProviderRuntimeDomainServices } from "@/server/services";
import type { RuntimeObservabilityDiagnostics } from "../domain/runtime-summary";
import type { RuntimeAlertService } from "./runtime-alert-service";
import type { RuntimeAuditService } from "./runtime-audit-service";
import type { DeadLetterOperationsService } from "./dead-letter-operations-service";
import type { RuntimeHealthService } from "./runtime-health-service";
import type { RuntimeProjectionService } from "./runtime-projection-service";
import type { ReplayOperationsService } from "./replay-operations-service";

export interface RuntimeObservabilityService {
  getDiagnostics(input: {
    organizationId: string;
    now: string;
  }): Promise<RuntimeObservabilityDiagnostics>;
}

export function createRuntimeObservabilityService(
  repositories: Pick<
    FirestoreRepositories,
    "runtimeJobs" | "slaTimers" | "deliveryPlans" | "deliveryAttempts" | "escalationOrchestrations"
  >,
  projectionService: RuntimeProjectionService,
  healthService: RuntimeHealthService,
  alertService: RuntimeAlertService,
  auditService: RuntimeAuditService,
  deadLetterService: DeadLetterOperationsService,
  replayService: ReplayOperationsService,
): RuntimeObservabilityService {
  return {
    async getDiagnostics(input) {
      const refreshed = await projectionService.refresh(input);
      const health = healthService.evaluate({
        projection: refreshed.projection,
        now: input.now,
      });
      const alerts = await alertService.sync({
        projection: refreshed.projection,
        now: input.now,
      });
      const [deadLetters, replay, repairHistory] = await Promise.all([
        deadLetterService.summarize({
          organizationId: input.organizationId,
          sources: refreshed.sources,
        }),
        replayService.summarize({
          organizationId: input.organizationId,
          sources: refreshed.sources,
        }),
        auditService.listRepairHistory({
          organizationId: input.organizationId,
          limit: 50,
        }),
      ]);

      return {
        projection: refreshed.projection,
        health,
        alerts,
        deadLetters,
        replay,
        repairHistory,
        freshness: {
          generatedAt: refreshed.projection.generatedAt,
          latestObservedUpdateAt: refreshed.projection.latestObservedUpdateAt,
          projectionLagMs: refreshed.projection.projectionLagMs,
        },
        queueDepth: {
          totalJobs: refreshed.projection.queue.totalJobCount,
          queuedJobs: refreshed.projection.queue.queuedCount,
          overdueQueuedJobs: refreshed.projection.queue.overdueQueuedCount,
          stuckJobs: refreshed.projection.queue.expiredLeaseCount,
        },
        subsystemSnapshots: {
          stuckJobs: refreshed.sources.jobs.filter((item) =>
            refreshed.projection.stuck.stuckRuntimeJobIds.includes(item.id),
          ),
          overdueSlaTimers: refreshed.sources.slaTimers.filter((item) =>
            refreshed.projection.stuck.overdueSlaTimerIds.includes(item.id),
          ),
          failedDeliveryPlans: refreshed.sources.deliveryPlans.filter((item) =>
            refreshed.projection.stuck.failedDeliveryPlanIds.includes(item.id),
          ),
          failedTransportAttempts: refreshed.sources.deliveryAttempts.filter((item) =>
            refreshed.projection.stuck.failedTransportAttemptIds.includes(item.id),
          ),
          activeEscalations: refreshed.sources.escalations.filter(
            (item) => item.status === "active",
          ),
        },
      };
    },
  };
}
