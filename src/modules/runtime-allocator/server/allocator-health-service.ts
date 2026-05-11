import "server-only";

import { ALLOCATOR_LEASE_STATUSES } from "../domain/allocator-lease";
import type { AllocatorLeaseService } from "./allocator-lease-service";

export interface AllocatorHealthService {
  getHealth(input: {
    now: string;
    shardCount: number;
  }): Promise<{
    status: "healthy" | "degraded";
    failoverState: "stable" | "recovering";
    shardCoverage: {
      totalShards: number;
      activeLeases: number;
      expiredLeases: number;
      unownedShards: number;
    };
    recoverableShardIds: readonly string[];
  }>;
}

export function createAllocatorHealthService(
  leaseService: AllocatorLeaseService,
): AllocatorHealthService {
  return {
    async getHealth(input) {
      const leases = await leaseService.listLeases({ now: input.now });
      const activeLeases = leases.filter((lease) => lease.status === ALLOCATOR_LEASE_STATUSES.Active);
      const expiredLeases = leases.filter((lease) => lease.status === ALLOCATOR_LEASE_STATUSES.Expired);
      const unownedShards = Math.max(0, input.shardCount - activeLeases.length);
      return {
        status: expiredLeases.length > 0 || unownedShards > 0 ? "degraded" : "healthy",
        failoverState: expiredLeases.length > 0 || unownedShards > 0 ? "recovering" : "stable",
        shardCoverage: {
          totalShards: input.shardCount,
          activeLeases: activeLeases.length,
          expiredLeases: expiredLeases.length,
          unownedShards,
        },
        recoverableShardIds: expiredLeases.map((lease) => lease.shardId).sort(),
      };
    },
  };
}
