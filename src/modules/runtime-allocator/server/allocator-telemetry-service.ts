import "server-only";

import type { AllocatorLeaseService } from "./allocator-lease-service";
import type { RuntimeAllocationRepository } from "./runtime-allocator-repository";
import type { RuntimeAllocatorService } from "./runtime-allocator-service";

export interface AllocatorTelemetryService {
  getTelemetry(input: {
    now: string;
    shardCount: number;
    totalCapacity: number;
  }): Promise<{
    fairnessDistribution: ReadonlyArray<{ tenantId: string; shardId: string; fairnessShare: number }>;
    tenantThroughput: ReadonlyArray<{ tenantId: string; grantedClaims: number; claimedClaims: number }>;
    queueWaitTimes: ReadonlyArray<{ tenantId: string; oldestQueueWaitMs: number }>;
    starvationIndicators: ReadonlyArray<{ tenantId: string; shardId: string; oldestQueueWaitMs: number }>;
    shardUtilization: ReadonlyArray<{ shardId: string; grantedCapacity: number; unallocatedCapacity: number }>;
    allocatorLeaseHealth: Awaited<ReturnType<AllocatorLeaseService["listLeases"]>>;
    workerPoolUtilization: { totalCapacity: number; grantedCapacity: number; claimedCapacity: number };
    replayRetryPressure: ReadonlyArray<{ tenantId: string; replayQueuedJobs: number; retryableFailuresInWindow: number }>;
    providerPressureSummaries: ReadonlyArray<{ tenantId: string; providerPressureLevel: string }>;
  }>;
}

export function createAllocatorTelemetryService(
  allocator: RuntimeAllocatorService,
  leaseService: AllocatorLeaseService,
  allocations: RuntimeAllocationRepository,
): AllocatorTelemetryService {
  return {
    async getTelemetry(input) {
      const [plan, leases, recentAllocations] = await Promise.all([
        allocator.inspect(input),
        leaseService.listLeases({ now: input.now }),
        allocations.listRecentAllocations({ limit: 50 }),
      ]);
      const claimedByTenant = new Map<string, number>();
      for (const allocation of recentAllocations) {
        for (const decision of allocation.decisions) {
          claimedByTenant.set(
            decision.tenantId,
            (claimedByTenant.get(decision.tenantId) ?? 0) + decision.grantedClaims,
          );
        }
      }

      const fairnessDistribution = plan.shardPlans.flatMap((shard) =>
        shard.decisions.map((decision) => ({
          tenantId: decision.tenantId,
          shardId: decision.shardId,
          fairnessShare: decision.fairnessShare,
        })),
      );
      return {
        fairnessDistribution,
        tenantThroughput: plan.tenantWorkloads.map((tenant) => ({
          tenantId: tenant.tenantId,
          grantedClaims: plan.shardPlans
            .flatMap((shard) => shard.decisions)
            .filter((decision) => decision.tenantId === tenant.tenantId)
            .reduce((sum, decision) => sum + decision.grantedClaims, 0),
          claimedClaims: claimedByTenant.get(tenant.tenantId) ?? 0,
        })),
        queueWaitTimes: plan.tenantWorkloads.map((tenant) => ({
          tenantId: tenant.tenantId,
          oldestQueueWaitMs: tenant.oldestQueueWaitMs,
        })),
        starvationIndicators: plan.tenantWorkloads
          .filter((tenant) => tenant.oldestQueueWaitMs >= 5 * 60 * 1000)
          .map((tenant) => ({
            tenantId: tenant.tenantId,
            shardId: tenant.shardId,
            oldestQueueWaitMs: tenant.oldestQueueWaitMs,
          })),
        shardUtilization: plan.shardPlans.map((shard) => ({
          shardId: shard.shardId,
          grantedCapacity: shard.grantedCapacity,
          unallocatedCapacity: shard.unallocatedCapacity,
        })),
        allocatorLeaseHealth: leases,
        workerPoolUtilization: {
          totalCapacity: plan.totalCapacity,
          grantedCapacity: plan.grantedCapacity,
          claimedCapacity: recentAllocations.reduce((sum, allocation) => sum + allocation.claimedCapacity, 0),
        },
        replayRetryPressure: plan.tenantWorkloads.map((tenant) => ({
          tenantId: tenant.tenantId,
          replayQueuedJobs: tenant.replayQueuedJobs,
          retryableFailuresInWindow: tenant.retryableFailuresInWindow,
        })),
        providerPressureSummaries: plan.tenantWorkloads.map((tenant) => ({
          tenantId: tenant.tenantId,
          providerPressureLevel: tenant.providerPressureLevel,
        })),
      };
    },
  };
}
