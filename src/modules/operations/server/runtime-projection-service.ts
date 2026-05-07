import "server-only";

import { WORKER_JOB_STATUSES, type EventProcessingRecord, type WorkerDeadLetterRecord, type WorkerJob } from "@/modules/runtime";
import { SLA_TIMER_STATUSES, type SlaTimer } from "@/modules/sla";
import { DELIVERY_PLAN_STATUSES, type DeliveryPlan } from "@/modules/delivery";
import type { EscalationOrchestration } from "@/modules/escalation";
import { DELIVERY_ATTEMPT_STATUSES, type DeliveryAttempt } from "@/modules/transport";
import type { ProviderReceipt } from "@/modules/provider-runtime";
import type { FirestoreRepositories } from "@/server/repositories";
import type { ProviderRuntimeDomainServices } from "@/server/services";
import {
  RUNTIME_HEALTH_STATUSES,
} from "../domain/runtime-health";
import type { RuntimeProjection } from "../domain/runtime-projection";
import {
  buildProjectionId,
  type RuntimeObservabilityRepositories,
} from "./runtime-observability-repository";
import type { RuntimeHealthService } from "./runtime-health-service";

export interface RuntimeProjectionService {
  refresh(input: {
    organizationId: string;
    now: string;
  }): Promise<{
    projection: RuntimeProjection;
    previousProjection: RuntimeProjection | null;
    sources: RuntimeProjectionSources;
  }>;
}

export interface RuntimeProjectionSources {
  jobs: readonly WorkerJob[];
  deadLetters: readonly WorkerDeadLetterRecord[];
  eventProcessings: readonly EventProcessingRecord[];
  deliveryPlans: readonly DeliveryPlan[];
  deliveryAttempts: readonly DeliveryAttempt[];
  escalations: readonly EscalationOrchestration[];
  slaTimers: readonly SlaTimer[];
  providerReceipts: readonly ProviderReceipt[];
}

export function createRuntimeProjectionService(
  repositories: Pick<
    FirestoreRepositories,
    | "runtimeJobs"
    | "runtimeDeadLetters"
    | "runtimeEventProcessings"
    | "deliveryPlans"
    | "deliveryAttempts"
    | "escalationOrchestrations"
    | "slaTimers"
  >,
  providerRuntime: Pick<ProviderRuntimeDomainServices, "health" | "storage">,
  observabilityRepositories: RuntimeObservabilityRepositories,
  healthService: RuntimeHealthService,
): RuntimeProjectionService {
  return {
    async refresh(input) {
      const previousProjection = await observabilityRepositories.projections.getByOrganizationId(
        input.organizationId,
      );
      const [
        jobs,
        deadLetters,
        eventProcessings,
        deliveryPlans,
        deliveryAttempts,
        escalations,
        slaTimers,
        providerHealth,
        providerReceipts,
      ] = await Promise.all([
        repositories.runtimeJobs.listByOrganizationId(input.organizationId, { limit: 500 }),
        repositories.runtimeDeadLetters.listByOrganizationId(input.organizationId, { limit: 500 }),
        repositories.runtimeEventProcessings.listByOrganizationId(input.organizationId, {
          limit: 500,
        }),
        repositories.deliveryPlans.listByOrganizationId(input.organizationId, { limit: 500 }),
        repositories.deliveryAttempts.listByOrganizationId(input.organizationId, { limit: 500 }),
        repositories.escalationOrchestrations.listByOrganizationId(input.organizationId, {
          limit: 500,
        }),
        repositories.slaTimers.listByOrganizationId(input.organizationId, { limit: 500 }),
        providerRuntime.health.getSummary({ organizationId: input.organizationId }),
        providerRuntime.storage.receipts.listByOrganizationId({
          organizationId: input.organizationId,
          limit: 500,
        }),
      ]);

      const jobItems = jobs.items;
      const deadLetterItems = deadLetters.items;
      const processingItems = eventProcessings.items;
      const planItems = deliveryPlans.items;
      const attemptItems = deliveryAttempts.items;
      const escalationItems = escalations.items;
      const timerItems = slaTimers.items;
      const providerReceiptItems = [...providerReceipts];
      const nowMs = Date.parse(input.now);

      const queuedJobs = jobItems.filter((item) => item.status === WORKER_JOB_STATUSES.Queued);
      const leasedJobs = jobItems.filter((item) => item.status === WORKER_JOB_STATUSES.Leased);
      const runningJobs = jobItems.filter((item) => item.status === WORKER_JOB_STATUSES.Running);
      const failedJobs = jobItems.filter((item) => item.status === WORKER_JOB_STATUSES.Failed);
      const deadLetteredJobs = jobItems.filter(
        (item) => item.status === WORKER_JOB_STATUSES.DeadLettered,
      );
      const overdueQueuedJobs = queuedJobs.filter(
        (item) => Date.parse(item.runAfter) <= nowMs,
      );
      const expiredLeaseJobs = [...leasedJobs, ...runningJobs].filter(
        (item) => item.leaseExpiresAt && Date.parse(item.leaseExpiresAt) <= nowMs,
      );
      const retryStormJobs = jobItems.filter((item) => item.attemptCount >= 3);
      const oldestQueuedAt = overdueQueuedJobs
        .map((item) => item.runAfter)
        .sort((left, right) => left.localeCompare(right))[0] ?? null;
      const queueLagMs = oldestQueuedAt ? Math.max(0, nowMs - Date.parse(oldestQueuedAt)) : 0;

      const failedEventProcessings = processingItems.filter((item) => item.status === "failed");
      const pendingProviderReceipts = providerReceiptItems.filter(
        (item) => item.reconciliationStatus === "pending",
      );
      const failedProviderReceipts = providerReceiptItems.filter(
        (item) => item.reconciliationStatus === "failed",
      );
      const ignoredProviderReceipts = providerReceiptItems.filter(
        (item) => item.reconciliationStatus === "ignored",
      );
      const unresolvedProviderReceipts = providerReceiptItems.filter(
        (item) =>
          item.reconciliationStatus === "pending" ||
          item.reconciliationReason === "delivery_attempt_not_found",
      );

      const overdueSlaTimers = timerItems.filter(
        (item) =>
          item.status === SLA_TIMER_STATUSES.Scheduled && Date.parse(item.dueAt) <= nowMs,
      );
      const activeEscalations = escalationItems.filter((item) => item.status === "active");
      const openDeliveryPlans = planItems.filter(
        (item) =>
          item.status === DELIVERY_PLAN_STATUSES.Planned ||
          item.status === DELIVERY_PLAN_STATUSES.Scheduled,
      );
      const failedDeliveryPlans = planItems.filter(
        (item) => item.status === DELIVERY_PLAN_STATUSES.Failed,
      );
      const retryScheduledAttempts = attemptItems.filter(
        (item) => item.status === DELIVERY_ATTEMPT_STATUSES.RetryScheduled,
      );
      const failedTransportAttempts = attemptItems.filter(
        (item) => item.status === DELIVERY_ATTEMPT_STATUSES.Failed,
      );

      const latestObservedUpdateAt = collectLatestTimestamp([
        ...jobItems.map((item) => item.updatedAt),
        ...deadLetterItems.map((item) => item.createdAt),
        ...processingItems.map((item) => item.updatedAt),
        ...planItems.map((item) => item.updatedAt),
        ...attemptItems.map((item) => item.updatedAt),
        ...escalationItems.map((item) => item.updatedAt),
        ...timerItems.map((item) => item.updatedAt),
        ...providerReceiptItems.map((item) => item.updatedAt),
      ]);

      const baseProjection: RuntimeProjection = {
        id: buildProjectionId(input.organizationId),
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        healthStatus: RUNTIME_HEALTH_STATUSES.Healthy,
        generatedAt: input.now,
        latestObservedUpdateAt,
        projectionLagMs:
          latestObservedUpdateAt === null ? 0 : Math.max(0, nowMs - Date.parse(latestObservedUpdateAt)),
        queue: {
          totalJobCount: jobItems.length,
          queuedCount: queuedJobs.length,
          leasedCount: leasedJobs.length,
          runningCount: runningJobs.length,
          failedCount: failedJobs.length,
          deadLetteredCount: deadLetteredJobs.length,
          overdueQueuedCount: overdueQueuedJobs.length,
          expiredLeaseCount: expiredLeaseJobs.length,
          retryStormCount: retryStormJobs.length,
          oldestQueuedAt,
          queueLagMs,
        },
        replay: {
          totalEventProcessings: processingItems.length,
          failedEventProcessings: failedEventProcessings.length,
          successfulEventProcessings:
            processingItems.length - failedEventProcessings.length,
          replayBacklogCount: failedEventProcessings.length,
          pendingProviderReceipts: pendingProviderReceipts.length,
          failedProviderReceipts: failedProviderReceipts.length,
          ignoredProviderReceipts: ignoredProviderReceipts.length,
          unresolvedProviderReceipts: unresolvedProviderReceipts.length,
        },
        provider: providerHealth.ok
          ? providerHealth.value
          : {
              duplicateWebhookCount: 0,
              reconciliationFailures: 0,
              pendingReceiptCount: 0,
              providerDeliverySummaries: [],
            },
        stuck: {
          stuckRuntimeJobIds: expiredLeaseJobs.map((item) => item.id),
          overdueSlaTimerIds: overdueSlaTimers.map((item) => item.id),
          failedDeliveryPlanIds: failedDeliveryPlans.map((item) => item.id),
          failedTransportAttemptIds: failedTransportAttempts.map((item) => item.id),
          unresolvedProviderReceiptIds: unresolvedProviderReceipts.map((item) => item.id),
        },
        totals: {
          slaTimerCount: timerItems.length,
          overdueSlaTimerCount: overdueSlaTimers.length,
          activeEscalationCount: activeEscalations.length,
          openDeliveryPlanCount: openDeliveryPlans.length,
          failedDeliveryPlanCount: failedDeliveryPlans.length,
          transportAttemptCount: attemptItems.length,
          retryScheduledAttemptCount: retryScheduledAttempts.length,
          failedTransportAttemptCount: failedTransportAttempts.length,
          deadLetterCount: deadLetterItems.length,
        },
        tenantSummary: {
          organizationId: input.organizationId,
          activeRuntimeWorkCount:
            queuedJobs.length +
            leasedJobs.length +
            runningJobs.length +
            openDeliveryPlans.length +
            activeEscalations.length,
          interventionRequiredCount:
            deadLetterItems.length +
            expiredLeaseJobs.length +
            overdueSlaTimers.length +
            failedEventProcessings.length +
            failedProviderReceipts.length +
            failedDeliveryPlans.length,
        },
        trends: {
          deadLetterDelta:
            deadLetterItems.length - (previousProjection?.totals.deadLetterCount ?? 0),
          replayBacklogDelta:
            failedEventProcessings.length -
            (previousProjection?.replay.replayBacklogCount ?? 0),
          failedReceiptDelta:
            failedProviderReceipts.length -
            (previousProjection?.replay.failedProviderReceipts ?? 0),
          queueLagDeltaMs: queueLagMs - (previousProjection?.queue.queueLagMs ?? 0),
        },
        createdAt: previousProjection?.createdAt ?? input.now,
        updatedAt: input.now,
      };

      const health = healthService.evaluate({
        projection: baseProjection,
        now: input.now,
      });
      const projection: RuntimeProjection = {
        ...baseProjection,
        healthStatus: health.status,
      };
      await observabilityRepositories.projections.save(projection);

      return {
        projection,
        previousProjection,
        sources: {
          jobs: jobItems,
          deadLetters: deadLetterItems,
          eventProcessings: processingItems,
          deliveryPlans: planItems,
          deliveryAttempts: attemptItems,
          escalations: escalationItems,
          slaTimers: timerItems,
          providerReceipts: providerReceiptItems,
        },
      };
    },
  };
}

function collectLatestTimestamp(values: readonly (string | null | undefined)[]): string | null {
  return values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((left, right) => right.localeCompare(left))[0] ?? null;
}
