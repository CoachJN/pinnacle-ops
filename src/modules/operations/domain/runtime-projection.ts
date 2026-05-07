import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { RuntimeHealthStatus } from "./runtime-health";

export interface RuntimeProjectionQueueSummary {
  totalJobCount: number;
  queuedCount: number;
  leasedCount: number;
  runningCount: number;
  failedCount: number;
  deadLetteredCount: number;
  overdueQueuedCount: number;
  expiredLeaseCount: number;
  retryStormCount: number;
  oldestQueuedAt: IsoDateTimeString | null;
  queueLagMs: number;
}

export interface RuntimeProjectionReplaySummary {
  totalEventProcessings: number;
  failedEventProcessings: number;
  successfulEventProcessings: number;
  replayBacklogCount: number;
  pendingProviderReceipts: number;
  failedProviderReceipts: number;
  ignoredProviderReceipts: number;
  unresolvedProviderReceipts: number;
}

export interface RuntimeProjectionProviderSummary {
  duplicateWebhookCount: number;
  reconciliationFailures: number;
  pendingReceiptCount: number;
  providerDeliverySummaries: ReadonlyArray<{
    providerType: string;
    accepted: number;
    delivered: number;
    failed: number;
  }>;
}

export interface RuntimeProjectionStuckSummary {
  stuckRuntimeJobIds: readonly EntityId[];
  overdueSlaTimerIds: readonly EntityId[];
  failedDeliveryPlanIds: readonly EntityId[];
  failedTransportAttemptIds: readonly EntityId[];
  unresolvedProviderReceiptIds: readonly EntityId[];
}

export interface RuntimeProjectionTrends {
  deadLetterDelta: number;
  replayBacklogDelta: number;
  failedReceiptDelta: number;
  queueLagDeltaMs: number;
}

export interface RuntimeProjection {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  healthStatus: RuntimeHealthStatus;
  generatedAt: IsoDateTimeString;
  latestObservedUpdateAt: IsoDateTimeString | null;
  projectionLagMs: number;
  queue: RuntimeProjectionQueueSummary;
  replay: RuntimeProjectionReplaySummary;
  provider: RuntimeProjectionProviderSummary;
  stuck: RuntimeProjectionStuckSummary;
  totals: {
    slaTimerCount: number;
    overdueSlaTimerCount: number;
    activeEscalationCount: number;
    openDeliveryPlanCount: number;
    failedDeliveryPlanCount: number;
    transportAttemptCount: number;
    retryScheduledAttemptCount: number;
    failedTransportAttemptCount: number;
    deadLetterCount: number;
  };
  tenantSummary: {
    organizationId: EntityId;
    activeRuntimeWorkCount: number;
    interventionRequiredCount: number;
  };
  trends: RuntimeProjectionTrends;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}
