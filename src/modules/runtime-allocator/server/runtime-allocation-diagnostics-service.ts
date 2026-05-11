import "server-only";

import type { AllocatorHealthService } from "./allocator-health-service";
import type { AllocatorLeaseService } from "./allocator-lease-service";
import type { AllocatorTelemetryService } from "./allocator-telemetry-service";
import type { RuntimeAllocationRepository } from "./runtime-allocator-repository";
import type { RuntimeAllocatorService } from "./runtime-allocator-service";
import type { RuntimeShardService } from "./runtime-shard-service";

export interface RuntimeAllocationDiagnosticsService {
  getDiagnostics(input: {
    now: string;
    shardCount: number;
    totalCapacity: number;
  }): Promise<{
    allocatorHealth: Awaited<ReturnType<AllocatorHealthService["getHealth"]>>;
    fairnessPlan: Awaited<ReturnType<RuntimeAllocatorService["inspect"]>>;
    telemetry: Awaited<ReturnType<AllocatorTelemetryService["getTelemetry"]>>;
    shardOwnership: Awaited<ReturnType<AllocatorLeaseService["listLeases"]>>;
    recentAllocations: Awaited<ReturnType<RuntimeAllocationRepository["listRecentAllocations"]>>;
    shardLayout: ReturnType<RuntimeShardService["assignTenantsToShards"]>;
  }>;
}

export function createRuntimeAllocationDiagnosticsService(
  health: AllocatorHealthService,
  allocator: RuntimeAllocatorService,
  telemetry: AllocatorTelemetryService,
  leases: AllocatorLeaseService,
  allocations: RuntimeAllocationRepository,
  shards: RuntimeShardService,
): RuntimeAllocationDiagnosticsService {
  return {
    async getDiagnostics(input) {
      const [allocatorHealth, fairnessPlan, telemetrySummary, shardOwnership, recentAllocations] =
        await Promise.all([
          health.getHealth({ now: input.now, shardCount: input.shardCount }),
          allocator.inspect(input),
          telemetry.getTelemetry(input),
          leases.listLeases({ now: input.now }),
          allocations.listRecentAllocations({ limit: 25 }),
        ]);

      return {
        allocatorHealth,
        fairnessPlan,
        telemetry: telemetrySummary,
        shardOwnership,
        recentAllocations,
        shardLayout: shards.assignTenantsToShards({
          shardCount: input.shardCount,
          tenants: fairnessPlan.tenantWorkloads.map((tenant) => ({
            organizationId: tenant.organizationId,
            tenantId: tenant.tenantId,
            queuedReadyJobs: tenant.queuedReadyJobs,
            queuedJobs: tenant.queuedJobs,
            activeJobs: tenant.activeJobs,
            replayQueuedJobs: tenant.replayQueuedJobs,
            retryableFailuresInWindow: tenant.retryableFailuresInWindow,
            providerPressureLevel: tenant.providerPressureLevel,
            shardId: tenant.shardId,
          })),
        }),
      };
    },
  };
}
