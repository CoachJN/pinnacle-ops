import "server-only";

import type { RuntimeBackpressureState } from "../domain/runtime-backpressure";
import type { TenantRuntimeQuota } from "../domain/tenant-runtime-quota";

export interface RuntimeFairnessTenant {
  tenantId: string;
  queuedJobs: number;
  activeJobs: number;
  requestedClaims: number;
  quota: TenantRuntimeQuota;
  backpressureState?: RuntimeBackpressureState;
}

export interface RuntimeFairnessAllocation {
  tenantId: string;
  grantedClaims: number;
  fairnessShare: number;
  reason: string | null;
}

export interface RuntimeFairnessPlan {
  totalCapacity: number;
  grantedCapacity: number;
  unallocatedCapacity: number;
  allocations: readonly RuntimeFairnessAllocation[];
}

export interface RuntimeFairnessService {
  planAllocations(input: {
    totalCapacity: number;
    tenants: readonly RuntimeFairnessTenant[];
  }): RuntimeFairnessPlan;
}

export function createRuntimeFairnessService(): RuntimeFairnessService {
  return {
    planAllocations(input) {
      const eligible = input.tenants
        .map((tenant) => ({
          ...tenant,
          grantedClaims: 0,
        }))
        .filter(
          (tenant) =>
            tenant.queuedJobs > 0 &&
            tenant.requestedClaims > 0 &&
            tenant.activeJobs < tenant.quota.maxConcurrentRuntimeJobs &&
            tenant.backpressureState !== "emergency",
        )
        .sort((left, right) => {
          if (left.activeJobs !== right.activeJobs) {
            return left.activeJobs - right.activeJobs;
          }
          if (left.queuedJobs !== right.queuedJobs) {
            return right.queuedJobs - left.queuedJobs;
          }
          return left.tenantId.localeCompare(right.tenantId);
        });

      let remaining = Math.max(0, input.totalCapacity);
      while (remaining > 0 && eligible.some((tenant) => canGrant(tenant))) {
        let grantedThisRound = false;
        for (const tenant of eligible) {
          if (!canGrant(tenant) || remaining <= 0) {
            continue;
          }
          tenant.grantedClaims += 1;
          remaining -= 1;
          grantedThisRound = true;
        }
        if (!grantedThisRound) {
          break;
        }
      }

      const allocations = input.tenants.map((tenant) => {
        const allocation = eligible.find((item) => item.tenantId === tenant.tenantId);
        const grantedClaims = allocation?.grantedClaims ?? 0;
        return {
          tenantId: tenant.tenantId,
          grantedClaims,
          fairnessShare:
            input.totalCapacity > 0 ? Number((grantedClaims / input.totalCapacity).toFixed(4)) : 0,
          reason:
            grantedClaims > 0
              ? null
              : tenant.backpressureState === "emergency"
                ? "Tenant is in emergency backpressure mode."
                : tenant.activeJobs >= tenant.quota.maxConcurrentRuntimeJobs
                  ? "Tenant is already at its concurrent runtime limit."
                  : tenant.queuedJobs <= 0
                    ? "Tenant has no queued work."
                    : "Tenant received no share in this bounded fairness cycle.",
        } satisfies RuntimeFairnessAllocation;
      });

      return {
        totalCapacity: Math.max(0, input.totalCapacity),
        grantedCapacity: input.totalCapacity - remaining,
        unallocatedCapacity: remaining,
        allocations,
      };
    },
  };
}

function canGrant(tenant: RuntimeFairnessTenant & { grantedClaims: number }): boolean {
  const concurrencyHeadroom = tenant.quota.maxConcurrentRuntimeJobs - tenant.activeJobs - tenant.grantedClaims;
  const requestHeadroom = tenant.requestedClaims - tenant.grantedClaims;
  const queueHeadroom = tenant.queuedJobs - tenant.grantedClaims;
  const batchHeadroom = tenant.quota.maxClaimBatchSize - tenant.grantedClaims;
  return concurrencyHeadroom > 0 && requestHeadroom > 0 && queueHeadroom > 0 && batchHeadroom > 0;
}
