import "server-only";

import type { RuntimeShard, RuntimeShardTenantAssignment } from "../domain/runtime-shard";

export interface ShardableTenantWorkload extends RuntimeShardTenantAssignment {
  shardId?: string;
}

export interface RuntimeShardService {
  getShardId(tenantId: string, shardCount: number): string;
  assignTenantsToShards(input: {
    shardCount: number;
    tenants: readonly ShardableTenantWorkload[];
  }): RuntimeShard[];
}

export function createRuntimeShardService(): RuntimeShardService {
  return {
    getShardId(tenantId, shardCount) {
      const normalizedShardCount = Math.max(1, shardCount);
      const ordinal = stableHash(tenantId) % normalizedShardCount;
      return `runtime-shard-${ordinal + 1}`;
    },
    assignTenantsToShards(input) {
      const shardCount = Math.max(1, input.shardCount);
      const shards = Array.from({ length: shardCount }, (_, index) => ({
        id: `runtime-shard-${index + 1}`,
        ordinal: index,
        tenants: [] as RuntimeShardTenantAssignment[],
      }));

      for (const tenant of input.tenants) {
        const shardId = tenant.shardId ?? this.getShardId(tenant.tenantId, shardCount);
        const shard = shards.find((item) => item.id === shardId);
        if (!shard) {
          continue;
        }
        shard.tenants.push({
          organizationId: tenant.organizationId,
          tenantId: tenant.tenantId,
          queuedReadyJobs: tenant.queuedReadyJobs,
          queuedJobs: tenant.queuedJobs,
          activeJobs: tenant.activeJobs,
          replayQueuedJobs: tenant.replayQueuedJobs,
          retryableFailuresInWindow: tenant.retryableFailuresInWindow,
          providerPressureLevel: tenant.providerPressureLevel,
        });
      }

      return shards.map((shard) => ({
        id: shard.id,
        ordinal: shard.ordinal,
        tenantCount: shard.tenants.length,
        queuedReadyJobs: shard.tenants.reduce((sum, tenant) => sum + tenant.queuedReadyJobs, 0),
        queuedJobs: shard.tenants.reduce((sum, tenant) => sum + tenant.queuedJobs, 0),
        activeJobs: shard.tenants.reduce((sum, tenant) => sum + tenant.activeJobs, 0),
        replayQueuedJobs: shard.tenants.reduce((sum, tenant) => sum + tenant.replayQueuedJobs, 0),
        providerIsolatedTenantCount: shard.tenants.filter((tenant) => tenant.providerPressureLevel === "isolated").length,
        tenants: shard.tenants.sort((left, right) => left.tenantId.localeCompare(right.tenantId)),
      }));
    },
  };
}

function stableHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}
