import "server-only";

import type { RuntimeAllocatorPlan, RuntimeAllocatorTenantWorkload } from "@/modules/runtime-allocator";
import type { RuntimeClaimDecision } from "../domain/runtime-claim-decision";

export interface RuntimeClaimBalancingSummary {
  orderedDecisions: readonly RuntimeClaimDecision[];
  replayPressureTenants: number;
  providerIsolatedTenants: number;
  starvationProtectedTenants: number;
}

export interface RuntimeClaimBalancerService {
  buildExecutionPlan(plan: RuntimeAllocatorPlan): RuntimeClaimBalancingSummary;
}

export function createRuntimeClaimBalancerService(): RuntimeClaimBalancerService {
  return {
    buildExecutionPlan(plan) {
      const workloadByTenant = new Map(plan.tenantWorkloads.map((item) => [tenantKey(item), item]));
      const orderedDecisions = plan.shardPlans
        .flatMap((shard) =>
          shard.decisions.map((decision) => toRuntimeClaimDecision(decision, workloadByTenant.get(tenantKey(decision)))),
        )
        .filter((decision) => decision.grantedClaims > 0)
        .sort((left, right) => {
          if (left.providerPressure !== right.providerPressure) {
            return providerRank(left.providerPressure) - providerRank(right.providerPressure);
          }
          if (left.replayPressure !== right.replayPressure) {
            return left.replayPressure - right.replayPressure;
          }
          if (left.oldestQueueWaitMs !== right.oldestQueueWaitMs) {
            return right.oldestQueueWaitMs - left.oldestQueueWaitMs;
          }
          if (left.shardId !== right.shardId) {
            return left.shardId.localeCompare(right.shardId);
          }
          return left.tenantId.localeCompare(right.tenantId);
        });

      return {
        orderedDecisions,
        replayPressureTenants: orderedDecisions.filter((item) => item.replayPressure > 0).length,
        providerIsolatedTenants: orderedDecisions.filter((item) => item.providerPressure === "isolated").length,
        starvationProtectedTenants: orderedDecisions.filter((item) => item.starvationPrevented).length,
      };
    },
  };
}

function toRuntimeClaimDecision(
  decision: RuntimeAllocatorPlan["shardPlans"][number]["decisions"][number],
  workload?: RuntimeAllocatorTenantWorkload,
): RuntimeClaimDecision {
  const quotaHeadroom = workload ? Math.max(0, workload.quota.maxConcurrentRuntimeJobs - workload.activeJobs) : 0;
  const replayPressure = workload
    ? Number((workload.replayQueuedJobs / Math.max(1, workload.queuedJobs || workload.queuedReadyJobs || 1)).toFixed(4))
    : 0;

  return {
    tenantId: decision.tenantId,
    organizationId: decision.organizationId,
    fairnessWeight: workload?.quota.fairnessWeight ?? 1,
    allocatorWindowId: workload ? `${decision.shardId}:${workload.tenantId}` : `${decision.shardId}:${decision.tenantId}`,
    shardId: decision.shardId,
    pressureState: workload?.backpressure.state ?? "normal",
    quotaHeadroom,
    replayPressure,
    providerPressure: decision.providerPressureLevel,
    claimDecisionReason: decision.reason,
    grantedClaims: decision.grantedClaims,
    effectiveWeight: decision.effectiveWeight,
    oldestQueueWaitMs: decision.oldestQueueWaitMs,
    starvationPrevented: decision.starvationPrevented,
  };
}

function providerRank(level: RuntimeClaimDecision["providerPressure"]): number {
  switch (level) {
    case "normal":
      return 0;
    case "throttled":
      return 1;
    default:
      return 2;
  }
}

function tenantKey(input: { organizationId: string; tenantId: string }): string {
  return `${input.organizationId}:${input.tenantId}`;
}
