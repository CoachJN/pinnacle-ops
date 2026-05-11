import type { EntityId } from "@/types/entity";

export interface TenantRuntimeQuotaThreshold {
  limit: number;
  windowMs: number;
}

export interface TenantRuntimeQuota {
  tenantId: EntityId;
  source: "default" | "override";
  fairnessWeight: number;
  maxConcurrentRuntimeJobs: number;
  maxQueuedJobs: number;
  maxReplayOperations: number;
  maxRepairOperations: number;
  maxProviderRequestsPerWindow: TenantRuntimeQuotaThreshold;
  maxDeliveryAttemptsPerWindow: TenantRuntimeQuotaThreshold;
  retryStormThreshold: TenantRuntimeQuotaThreshold;
  deadLetterThreshold: number;
  escalationLimit: number;
  projectionRefreshFrequencyLimit: TenantRuntimeQuotaThreshold;
  maxClaimBatchSize: number;
  maxSchedulerBatchSize: number;
}

export interface TenantRuntimeQuotaUtilization {
  activeRuntimeJobs: number;
  queuedRuntimeJobs: number;
  replayOperationsInWindow: number;
  repairOperationsInWindow: number;
  providerRequestsInWindow: number;
  deliveryAttemptsInWindow: number;
  retryableFailuresInWindow: number;
  deadLetterCount: number;
  activeEscalations: number;
  projectionRefreshesInWindow: number;
}

export const DEFAULT_TENANT_RUNTIME_QUOTA: Omit<TenantRuntimeQuota, "tenantId" | "source"> = {
  fairnessWeight: 1,
  maxConcurrentRuntimeJobs: 8,
  maxQueuedJobs: 200,
  maxReplayOperations: 20,
  maxRepairOperations: 12,
  maxProviderRequestsPerWindow: {
    limit: 120,
    windowMs: 15 * 60 * 1000,
  },
  maxDeliveryAttemptsPerWindow: {
    limit: 240,
    windowMs: 15 * 60 * 1000,
  },
  retryStormThreshold: {
    limit: 8,
    windowMs: 10 * 60 * 1000,
  },
  deadLetterThreshold: 50,
  escalationLimit: 25,
  projectionRefreshFrequencyLimit: {
    limit: 6,
    windowMs: 60 * 60 * 1000,
  },
  maxClaimBatchSize: 4,
  maxSchedulerBatchSize: 4,
};
