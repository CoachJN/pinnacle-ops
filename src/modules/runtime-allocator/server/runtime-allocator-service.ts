import "server-only";

import {
  DEFAULT_TENANT_RUNTIME_QUOTA,
  evaluateBackpressureSnapshot,
  summarizeProviderIsolation,
  type TenantRuntimeQuota,
} from "@/modules/runtime-capacity";
import type { ProviderReceipt } from "@/modules/provider-runtime";
import type { WorkerJob } from "@/modules/runtime";
import { createFairnessEngineService, type FairnessEngineService } from "./fairness-engine-service";
import { createRuntimeShardService, type RuntimeShardService } from "./runtime-shard-service";
import type { RuntimeAllocatorGlobalRepository } from "./runtime-allocator-repository";

export interface RuntimeAllocatorTenantWorkload {
  organizationId: string;
  tenantId: string;
  shardId: string;
  queuedReadyJobs: number;
  queuedJobs: number;
  activeJobs: number;
  replayQueuedJobs: number;
  retryableFailuresInWindow: number;
  oldestQueuedAt: string | null;
  oldestQueueWaitMs: number;
  providerPressureLevel: "normal" | "throttled" | "isolated";
  quota: TenantRuntimeQuota;
  backpressure: ReturnType<typeof evaluateBackpressureSnapshot>;
}

export interface RuntimeAllocatorPlan {
  observedAt: string;
  totalCapacity: number;
  grantedCapacity: number;
  unallocatedCapacity: number;
  shardPlans: ReadonlyArray<{
    shardId: string;
    grantedCapacity: number;
    unallocatedCapacity: number;
    window: ReturnType<FairnessEngineService["planShard"]>["window"];
    decisions: ReturnType<FairnessEngineService["planShard"]>["decisions"];
  }>;
  tenantWorkloads: readonly RuntimeAllocatorTenantWorkload[];
}

export interface RuntimeAllocatorService {
  inspect(input: {
    now: string;
    shardCount: number;
    totalCapacity: number;
    quotaOverrides?: Partial<Record<string, Partial<TenantRuntimeQuota>>>;
  }): Promise<RuntimeAllocatorPlan>;
}

export function createRuntimeAllocatorService(
  repository: RuntimeAllocatorGlobalRepository,
  dependencies: {
    fairness?: FairnessEngineService;
    shards?: RuntimeShardService;
  } = {},
): RuntimeAllocatorService {
  const fairness = dependencies.fairness ?? createFairnessEngineService();
  const shards = dependencies.shards ?? createRuntimeShardService();

  return {
    async inspect(input) {
      const [jobs, receipts] = await Promise.all([
        repository.listRuntimeJobs({ limit: 2_000, statuses: ["queued", "leased", "running"] }),
        repository.listProviderReceipts({ limit: 2_000 }),
      ]);
      const tenantWorkloads = buildTenantWorkloads(jobs, receipts, input.now, input.shardCount, shards, input.quotaOverrides);
      const shardCapacity = splitCapacityAcrossShards(input.totalCapacity, input.shardCount);

      const shardPlans = shardCapacity.map(({ shardId, capacity }) => {
        const shardTenants = tenantWorkloads.filter((tenant) => tenant.shardId === shardId);
        const plan = fairness.planShard({
          shardId,
          totalCapacity: capacity,
          now: input.now,
          tenants: shardTenants,
        });
        return {
          shardId,
          grantedCapacity: plan.grantedCapacity,
          unallocatedCapacity: plan.unallocatedCapacity,
          window: plan.window,
          decisions: plan.decisions,
        };
      });

      return {
        observedAt: input.now,
        totalCapacity: Math.max(0, input.totalCapacity),
        grantedCapacity: shardPlans.reduce((sum, shard) => sum + shard.grantedCapacity, 0),
        unallocatedCapacity: shardPlans.reduce((sum, shard) => sum + shard.unallocatedCapacity, 0),
        shardPlans,
        tenantWorkloads,
      };
    },
  };
}

export function buildTenantWorkloads(
  jobs: readonly WorkerJob[],
  receipts: readonly ProviderReceipt[],
  now: string,
  shardCount: number,
  shardService: RuntimeShardService,
  quotaOverrides?: Partial<Record<string, Partial<TenantRuntimeQuota>>>,
): RuntimeAllocatorTenantWorkload[] {
  const jobsByTenant = new Map<string, WorkerJob[]>();
  for (const job of jobs) {
    const key = buildTenantKey(job.organizationId, job.tenantId);
    const current = jobsByTenant.get(key) ?? [];
    current.push(job);
    jobsByTenant.set(key, current);
  }

  const receiptsByTenant = new Map<string, ProviderReceipt[]>();
  for (const receipt of receipts) {
    const key = buildTenantKey(receipt.organizationId, receipt.tenantId);
    const current = receiptsByTenant.get(key) ?? [];
    current.push(receipt);
    receiptsByTenant.set(key, current);
  }

  return [...jobsByTenant.entries()]
    .map(([key, tenantJobs]) => {
      const [organizationId, tenantId] = key.split(":");
      const quota = buildQuota(tenantId, quotaOverrides?.[tenantId]);
      const queuedJobs = tenantJobs.filter((job) => job.status === "queued");
      const queuedReadyJobs = queuedJobs.filter((job) => job.runAfter <= now);
      const activeJobs = tenantJobs.filter((job) => job.status === "leased" || job.status === "running").length;
      const replayQueuedJobs = queuedJobs.filter((job) => job.type.includes("replay")).length;
      const retryableFailuresInWindow = tenantJobs.filter(
        (job) =>
          Boolean(job.lastError?.retryable) &&
          Date.parse(job.updatedAt) >= Date.parse(now) - quota.retryStormThreshold.windowMs,
      ).length;
      const oldestQueuedAt = queuedReadyJobs
        .map((job) => job.runAfter)
        .sort((left, right) => left.localeCompare(right))[0] ?? null;
      const oldestQueueWaitMs = oldestQueuedAt ? Math.max(0, Date.parse(now) - Date.parse(oldestQueuedAt)) : 0;
      const tenantReceipts = receiptsByTenant.get(key) ?? [];
      const providerSummary = summarizeProviderIsolation(
        {
          organizationId,
          tenantId,
          observedAt: now,
          jobs: tenantJobs,
          deadLetters: [],
          deliveryAttempts: [],
          providerReceipts: tenantReceipts,
          escalations: [],
          repairActions: [],
          projectionGeneratedAt: null,
          utilization: {
            activeRuntimeJobs: activeJobs,
            queuedRuntimeJobs: queuedJobs.length,
            replayOperationsInWindow: replayQueuedJobs,
            repairOperationsInWindow: 0,
            providerRequestsInWindow: tenantReceipts.length,
            deliveryAttemptsInWindow: 0,
            retryableFailuresInWindow,
            deadLetterCount: 0,
            activeEscalations: 0,
            projectionRefreshesInWindow: queuedJobs.filter((job) => job.type === "operations.projection.refresh").length,
          },
        },
        now,
      );
      const backpressure = evaluateBackpressureSnapshot(
        {
          organizationId,
          tenantId,
          observedAt: now,
          jobs: tenantJobs,
          deadLetters: [],
          deliveryAttempts: [],
          providerReceipts: tenantReceipts,
          escalations: [],
          repairActions: [],
          projectionGeneratedAt: null,
          utilization: {
            activeRuntimeJobs: activeJobs,
            queuedRuntimeJobs: queuedJobs.length,
            replayOperationsInWindow: replayQueuedJobs,
            repairOperationsInWindow: 0,
            providerRequestsInWindow: tenantReceipts.length,
            deliveryAttemptsInWindow: 0,
            retryableFailuresInWindow,
            deadLetterCount: 0,
            activeEscalations: 0,
            projectionRefreshesInWindow: queuedJobs.filter((job) => job.type === "operations.projection.refresh").length,
          },
        },
        quota,
        providerSummary,
      );

      return {
        organizationId,
        tenantId,
        shardId: shardService.getShardId(tenantId, shardCount),
        queuedReadyJobs: queuedReadyJobs.length,
        queuedJobs: queuedJobs.length,
        activeJobs,
        replayQueuedJobs,
        retryableFailuresInWindow,
        oldestQueuedAt,
        oldestQueueWaitMs,
        providerPressureLevel: providerSummary.isolatedProviders.length > 0
          ? "isolated"
          : providerSummary.throttledProviders.length > 0
            ? "throttled"
            : "normal",
        quota,
        backpressure,
      } satisfies RuntimeAllocatorTenantWorkload;
    })
    .filter((tenant) => tenant.queuedJobs > 0 || tenant.activeJobs > 0)
    .sort((left, right) => left.tenantId.localeCompare(right.tenantId));
}

function splitCapacityAcrossShards(totalCapacity: number, shardCount: number) {
  const normalizedCapacity = Math.max(0, totalCapacity);
  const normalizedShardCount = Math.max(1, shardCount);
  const base = Math.floor(normalizedCapacity / normalizedShardCount);
  let remainder = normalizedCapacity % normalizedShardCount;

  return Array.from({ length: normalizedShardCount }, (_, index) => {
    const capacity = base + (remainder > 0 ? 1 : 0);
    remainder = Math.max(0, remainder - 1);
    return {
      shardId: `runtime-shard-${index + 1}`,
      capacity,
    };
  });
}

function buildTenantKey(organizationId: string, tenantId: string): string {
  return `${organizationId}:${tenantId}`;
}

function buildQuota(tenantId: string, override?: Partial<TenantRuntimeQuota>): TenantRuntimeQuota {
  return {
    tenantId,
    source: override ? "override" : "default",
    ...DEFAULT_TENANT_RUNTIME_QUOTA,
    ...override,
    maxProviderRequestsPerWindow: {
      ...DEFAULT_TENANT_RUNTIME_QUOTA.maxProviderRequestsPerWindow,
      ...override?.maxProviderRequestsPerWindow,
    },
    maxDeliveryAttemptsPerWindow: {
      ...DEFAULT_TENANT_RUNTIME_QUOTA.maxDeliveryAttemptsPerWindow,
      ...override?.maxDeliveryAttemptsPerWindow,
    },
    retryStormThreshold: {
      ...DEFAULT_TENANT_RUNTIME_QUOTA.retryStormThreshold,
      ...override?.retryStormThreshold,
    },
    projectionRefreshFrequencyLimit: {
      ...DEFAULT_TENANT_RUNTIME_QUOTA.projectionRefreshFrequencyLimit,
      ...override?.projectionRefreshFrequencyLimit,
    },
  };
}
