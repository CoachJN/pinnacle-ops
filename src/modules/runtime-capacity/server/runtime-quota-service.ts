import "server-only";

import type { DeliveryAttempt, DeliveryAttemptStatus } from "@/modules/transport";
import type { ProviderReceipt, ProviderRuntimeStorage } from "@/modules/provider-runtime";
import type { RuntimeProjectionRepository, RuntimeRepairActionRepository } from "@/modules/operations/server/runtime-observability-repository";
import type { FirestoreRepositories } from "@/server/repositories";
import type { EntityId } from "@/types/entity";
import {
  DEFAULT_TENANT_RUNTIME_QUOTA,
  type TenantRuntimeQuota,
  type TenantRuntimeQuotaUtilization,
} from "../domain/tenant-runtime-quota";

type RuntimeJob = Awaited<
  ReturnType<FirestoreRepositories["runtimeJobs"]["listByOrganizationId"]>
>["items"][number];

type RuntimeDeadLetter = Awaited<
  ReturnType<FirestoreRepositories["runtimeDeadLetters"]["listByOrganizationId"]>
>["items"][number];

type Escalation = Awaited<
  ReturnType<FirestoreRepositories["escalationOrchestrations"]["listByOrganizationId"]>
>["items"][number];

type RuntimeRepairAction = Awaited<ReturnType<RuntimeRepairActionRepository["listByOrganizationId"]>>[number];

export interface RuntimeCapacityRepositories {
  runtimeJobs: Pick<FirestoreRepositories["runtimeJobs"], "listByOrganizationId">;
  runtimeDeadLetters: Pick<FirestoreRepositories["runtimeDeadLetters"], "listByOrganizationId">;
  deliveryAttempts?: Pick<FirestoreRepositories["deliveryAttempts"], "listByOrganizationId">;
  escalationOrchestrations?: Pick<FirestoreRepositories["escalationOrchestrations"], "listByOrganizationId">;
}

export interface RuntimeCapacityObservabilityRepositories {
  repairActions?: Pick<RuntimeRepairActionRepository, "listByOrganizationId">;
  projections?: Pick<RuntimeProjectionRepository, "getByOrganizationId">;
}

export interface RuntimeCapacityDataSources {
  repositories: RuntimeCapacityRepositories;
  providerRuntimeStorage?: ProviderRuntimeStorage;
  observability?: RuntimeCapacityObservabilityRepositories;
}

export interface RuntimeCapacitySnapshot {
  organizationId: EntityId;
  tenantId: EntityId;
  observedAt: string;
  jobs: readonly RuntimeJob[];
  deadLetters: readonly RuntimeDeadLetter[];
  deliveryAttempts: readonly DeliveryAttempt[];
  providerReceipts: readonly ProviderReceipt[];
  escalations: readonly Escalation[];
  repairActions: readonly RuntimeRepairAction[];
  projectionGeneratedAt: string | null;
  utilization: TenantRuntimeQuotaUtilization;
}

export interface RuntimeQuotaVerdict {
  allowed: boolean;
  reason: string | null;
  quota: TenantRuntimeQuota;
  utilization: TenantRuntimeQuotaUtilization;
}

export interface RuntimeQuotaService {
  getQuota(input: { tenantId: EntityId }): TenantRuntimeQuota;
  buildSnapshot(input: {
    organizationId: EntityId;
    tenantId?: EntityId | null;
    now: string;
  }): Promise<RuntimeCapacitySnapshot>;
  evaluateEnqueue(input: {
    organizationId: EntityId;
    tenantId?: EntityId | null;
    jobType: string;
    now: string;
  }): Promise<RuntimeQuotaVerdict>;
  evaluateClaim(input: {
    organizationId: EntityId;
    tenantId?: EntityId | null;
    now: string;
  }): Promise<RuntimeQuotaVerdict>;
}

export function createRuntimeQuotaService(
  sources: RuntimeCapacityDataSources,
  overrides: Partial<Record<string, Partial<TenantRuntimeQuota>>> = {},
): RuntimeQuotaService {
  return {
    getQuota(input) {
      const override = overrides[input.tenantId] ?? {};
      return {
        tenantId: input.tenantId,
        source: Object.keys(override).length > 0 ? "override" : "default",
        ...DEFAULT_TENANT_RUNTIME_QUOTA,
        ...override,
        maxProviderRequestsPerWindow: {
          ...DEFAULT_TENANT_RUNTIME_QUOTA.maxProviderRequestsPerWindow,
          ...override.maxProviderRequestsPerWindow,
        },
        maxDeliveryAttemptsPerWindow: {
          ...DEFAULT_TENANT_RUNTIME_QUOTA.maxDeliveryAttemptsPerWindow,
          ...override.maxDeliveryAttemptsPerWindow,
        },
        retryStormThreshold: {
          ...DEFAULT_TENANT_RUNTIME_QUOTA.retryStormThreshold,
          ...override.retryStormThreshold,
        },
        projectionRefreshFrequencyLimit: {
          ...DEFAULT_TENANT_RUNTIME_QUOTA.projectionRefreshFrequencyLimit,
          ...override.projectionRefreshFrequencyLimit,
        },
      };
    },
    async buildSnapshot(input) {
      return buildRuntimeCapacitySnapshot(sources, this.getQuota({ tenantId: input.tenantId ?? input.organizationId }), {
        organizationId: input.organizationId,
        tenantId: input.tenantId ?? input.organizationId,
        now: input.now,
      });
    },
    async evaluateEnqueue(input) {
      const tenantId = input.tenantId ?? input.organizationId;
      const quota = this.getQuota({ tenantId });
      const snapshot = await this.buildSnapshot({
        organizationId: input.organizationId,
        tenantId,
        now: input.now,
      });

      if (snapshot.utilization.queuedRuntimeJobs >= quota.maxQueuedJobs) {
        return blockedVerdict(quota, snapshot.utilization, "Queued runtime job quota exceeded.");
      }

      if (isReplayRuntimeJobType(input.jobType) && snapshot.utilization.replayOperationsInWindow >= quota.maxReplayOperations) {
        return blockedVerdict(quota, snapshot.utilization, "Replay quota exceeded for this tenant.");
      }

      if (isRepairRuntimeJobType(input.jobType) && snapshot.utilization.repairOperationsInWindow >= quota.maxRepairOperations) {
        return blockedVerdict(quota, snapshot.utilization, "Repair quota exceeded for this tenant.");
      }

      if (
        isProjectionRefreshRuntimeJobType(input.jobType) &&
        snapshot.utilization.projectionRefreshesInWindow >= quota.projectionRefreshFrequencyLimit.limit
      ) {
        return blockedVerdict(
          quota,
          snapshot.utilization,
          "Projection refresh frequency limit exceeded for this tenant.",
        );
      }

      return allowedVerdict(quota, snapshot.utilization);
    },
    async evaluateClaim(input) {
      const tenantId = input.tenantId ?? input.organizationId;
      const quota = this.getQuota({ tenantId });
      const snapshot = await this.buildSnapshot({
        organizationId: input.organizationId,
        tenantId,
        now: input.now,
      });
      if (snapshot.utilization.activeRuntimeJobs >= quota.maxConcurrentRuntimeJobs) {
        return blockedVerdict(quota, snapshot.utilization, "Concurrent runtime job quota exceeded.");
      }
      return allowedVerdict(quota, snapshot.utilization);
    },
  };
}

export async function buildRuntimeCapacitySnapshot(
  sources: RuntimeCapacityDataSources,
  quota: TenantRuntimeQuota,
  input: {
    organizationId: EntityId;
    tenantId: EntityId;
    now: string;
  },
): Promise<RuntimeCapacitySnapshot> {
  const [jobsResult, deadLetterResult, deliveryAttemptResult, providerReceipts, escalationsResult, repairActions, projection] =
    await Promise.all([
      sources.repositories.runtimeJobs.listByOrganizationId(input.organizationId, { limit: 500 }),
      sources.repositories.runtimeDeadLetters.listByOrganizationId(input.organizationId, { limit: 500 }),
      sources.repositories.deliveryAttempts?.listByOrganizationId(input.organizationId, { limit: 500 }) ??
        Promise.resolve({ items: [], count: 0 }),
      sources.providerRuntimeStorage?.receipts.listByOrganizationId({
        organizationId: input.organizationId,
        limit: 500,
      }) ?? Promise.resolve([]),
      sources.repositories.escalationOrchestrations?.listByOrganizationId(input.organizationId, { limit: 250 }) ??
        Promise.resolve({ items: [], count: 0 }),
      sources.observability?.repairActions?.listByOrganizationId({
        organizationId: input.organizationId,
        limit: 250,
      }) ?? Promise.resolve([]),
      sources.observability?.projections?.getByOrganizationId(input.organizationId) ?? Promise.resolve(null),
    ]);

  const jobs = jobsResult.items.filter((job) => job.tenantId === input.tenantId);
  const deadLetters = deadLetterResult.items.filter((record) => record.tenantId === input.tenantId);
  const deliveryAttempts = deliveryAttemptResult.items.filter((attempt) => attempt.tenantId === input.tenantId);
  const tenantReceipts = providerReceipts.filter((receipt) => receipt.tenantId === input.tenantId);
  const escalations = escalationsResult.items.filter((item) => item.tenantId === input.tenantId);
  const tenantRepairActions = repairActions.filter((item) => item.tenantId === input.tenantId);

  return {
    organizationId: input.organizationId,
    tenantId: input.tenantId,
    observedAt: input.now,
    jobs,
    deadLetters,
    deliveryAttempts,
    providerReceipts: tenantReceipts,
    escalations,
    repairActions: tenantRepairActions,
    projectionGeneratedAt: projection?.generatedAt ?? null,
    utilization: {
      activeRuntimeJobs: jobs.filter((job) => isActiveRuntimeStatus(job.status)).length,
      queuedRuntimeJobs: jobs.filter((job) => job.status === "queued").length,
      replayOperationsInWindow: jobs.filter((job) => isReplayRuntimeJobType(job.type)).length,
      repairOperationsInWindow: tenantRepairActions.filter((item) => isWithinWindow(item.requestedAt, input.now, quota.maxDeliveryAttemptsPerWindow.windowMs)).length,
      providerRequestsInWindow: tenantReceipts.filter((receipt) =>
        isWithinWindow(receipt.receivedAt, input.now, quota.maxProviderRequestsPerWindow.windowMs),
      ).length,
      deliveryAttemptsInWindow: deliveryAttempts.filter((attempt) =>
        isWithinWindow(attempt.createdAt, input.now, quota.maxDeliveryAttemptsPerWindow.windowMs),
      ).length,
      retryableFailuresInWindow: jobs.filter((job) =>
        Boolean(job.lastError?.retryable) &&
        isWithinWindow(job.updatedAt, input.now, quota.retryStormThreshold.windowMs),
      ).length,
      deadLetterCount: deadLetters.length,
      activeEscalations: escalations.filter((item) => item.status === "active").length,
      projectionRefreshesInWindow: jobs.filter((job) =>
        isProjectionRefreshRuntimeJobType(job.type) &&
        isWithinWindow(job.createdAt, input.now, quota.projectionRefreshFrequencyLimit.windowMs),
      ).length,
    },
  };
}

export function isActiveRuntimeStatus(status: string): boolean {
  return status === "queued" || status === "leased" || status === "running";
}

export function isReplayRuntimeJobType(jobType: string): boolean {
  return jobType.includes("replay");
}

export function isRepairRuntimeJobType(jobType: string): boolean {
  return jobType.includes("repair");
}

export function isProjectionRefreshRuntimeJobType(jobType: string): boolean {
  return jobType === "operations.projection.refresh";
}

export function isProviderRuntimeJobType(jobType: string): boolean {
  return jobType.startsWith("provider.");
}

export function inferProviderTypeFromJobType(jobType: string): string | null {
  if (!isProviderRuntimeJobType(jobType)) {
    return null;
  }
  if (jobType.includes("microsoft")) {
    return "microsoft_graph_email";
  }
  return "provider_runtime";
}

export function isDeliveryAttemptFailureStatus(status: DeliveryAttemptStatus): boolean {
  return status === "failed" || status === "retry_scheduled";
}

function allowedVerdict(
  quota: TenantRuntimeQuota,
  utilization: TenantRuntimeQuotaUtilization,
): RuntimeQuotaVerdict {
  return {
    allowed: true,
    reason: null,
    quota,
    utilization,
  };
}

function blockedVerdict(
  quota: TenantRuntimeQuota,
  utilization: TenantRuntimeQuotaUtilization,
  reason: string,
): RuntimeQuotaVerdict {
  return {
    allowed: false,
    reason,
    quota,
    utilization,
  };
}

export function isWithinWindow(timestamp: string, now: string, windowMs: number): boolean {
  return Date.parse(now) - Date.parse(timestamp) <= windowMs;
}
