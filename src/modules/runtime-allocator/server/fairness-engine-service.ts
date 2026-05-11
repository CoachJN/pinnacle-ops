import "server-only";

import type { RuntimeBackpressureEvaluation, TenantRuntimeQuota } from "@/modules/runtime-capacity";
import type { FairnessWindow, FairnessWindowTenantState } from "../domain/fairness-window";
import type { RuntimeAllocationDecision } from "../domain/runtime-allocation";

export interface FairnessEngineTenantInput {
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
  backpressure: RuntimeBackpressureEvaluation;
}

export interface FairnessEnginePlan {
  window: FairnessWindow;
  decisions: readonly RuntimeAllocationDecision[];
  grantedCapacity: number;
  unallocatedCapacity: number;
}

export interface FairnessEngineService {
  planShard(input: {
    shardId: string;
    totalCapacity: number;
    now: string;
    windowDurationMs?: number;
    starvationThresholdMs?: number;
    tenants: readonly FairnessEngineTenantInput[];
  }): FairnessEnginePlan;
}

export function createFairnessEngineService(): FairnessEngineService {
  return {
    planShard(input) {
      const starvationThresholdMs = input.starvationThresholdMs ?? 5 * 60 * 1000;
      const windowDurationMs = input.windowDurationMs ?? 60 * 1000;
      const tenantStates = input.tenants
        .map((tenant) => toFairnessState(tenant, starvationThresholdMs))
        .sort((left, right) => left.tenantId.localeCompare(right.tenantId));

      const grantState = new Map(tenantStates.map((tenant) => [tenant.tenantId, 0]));
      let remaining = Math.max(0, input.totalCapacity);

      while (remaining > 0) {
        const candidates = tenantStates.filter((tenant) => canGrant(tenant, grantState.get(tenant.tenantId) ?? 0));
        if (candidates.length === 0) {
          break;
        }

        candidates.sort((left, right) => {
          const leftGranted = grantState.get(left.tenantId) ?? 0;
          const rightGranted = grantState.get(right.tenantId) ?? 0;
          const leftScore = (left.activeJobs + leftGranted) / left.effectiveWeight;
          const rightScore = (right.activeJobs + rightGranted) / right.effectiveWeight;
          if (leftScore !== rightScore) {
            return leftScore - rightScore;
          }
          if (left.oldestQueueWaitMs !== right.oldestQueueWaitMs) {
            return right.oldestQueueWaitMs - left.oldestQueueWaitMs;
          }
          if (left.replayQueuedJobs !== right.replayQueuedJobs) {
            return left.replayQueuedJobs - right.replayQueuedJobs;
          }
          return left.tenantId.localeCompare(right.tenantId);
        });

        const selected = candidates[0];
        grantState.set(selected.tenantId, (grantState.get(selected.tenantId) ?? 0) + 1);
        remaining -= 1;
      }

      const grantedCapacity = Math.max(0, input.totalCapacity - remaining);
      const decisions = tenantStates.map((tenant) => {
        const grantedClaims = grantState.get(tenant.tenantId) ?? 0;
        return {
          organizationId: tenant.organizationId,
          tenantId: tenant.tenantId,
          shardId: tenant.shardId,
          grantedClaims,
          fairnessShare: grantedCapacity > 0 ? Number((grantedClaims / grantedCapacity).toFixed(4)) : 0,
          effectiveWeight: Number(tenant.effectiveWeight.toFixed(4)),
          oldestQueueWaitMs: tenant.oldestQueueWaitMs,
          starvationPrevented: grantedClaims > 0 && tenant.oldestQueueWaitMs >= starvationThresholdMs,
          replayStormIsolated: tenant.replayQueuedJobs > 0 && tenant.pressurePenalty < 1,
          providerPressureLevel: tenant.providerPressureLevel,
          reason:
            grantedClaims > 0
              ? null
              : tenant.reasons[0] ?? "Tenant received no share in this bounded fairness window.",
        } satisfies RuntimeAllocationDecision;
      });

      return {
        window: {
          id: `${input.shardId}:${truncateWindow(input.now, windowDurationMs)}`,
          startedAt: truncateWindow(input.now, windowDurationMs),
          endsAt: new Date(Date.parse(truncateWindow(input.now, windowDurationMs)) + windowDurationMs).toISOString(),
          shardId: input.shardId,
          totalCapacity: Math.max(0, input.totalCapacity),
          unallocatedCapacity: remaining,
          starvationThresholdMs,
          tenants: tenantStates,
        },
        decisions,
        grantedCapacity,
        unallocatedCapacity: remaining,
      };
    },
  };
}

function toFairnessState(
  tenant: FairnessEngineTenantInput,
  starvationThresholdMs: number,
): FairnessWindowTenantState {
  const reasons: string[] = [];
  const headroom = Math.max(0, tenant.quota.maxConcurrentRuntimeJobs - tenant.activeJobs);
  const requestedClaims = Math.min(tenant.queuedReadyJobs, tenant.quota.maxClaimBatchSize, headroom);
  const starvationBoost = requestedClaims > 0
    ? Math.min(3, 1 + Math.floor(tenant.oldestQueueWaitMs / Math.max(1, starvationThresholdMs)))
    : 1;

  let pressurePenalty = 1;
  if (tenant.providerPressureLevel === "isolated") {
    pressurePenalty = 0;
    reasons.push("Provider isolation removed this tenant from shared capacity.");
  } else if (tenant.providerPressureLevel === "throttled") {
    pressurePenalty *= 0.5;
    reasons.push("Provider pressure reduced this tenant's shared capacity weight.");
  }

  if (tenant.backpressure.state === "emergency") {
    pressurePenalty = 0;
    reasons.push("Emergency backpressure removed this tenant from shared capacity.");
  } else if (tenant.backpressure.state === "degraded") {
    pressurePenalty *= 0.5;
    reasons.push("Degraded backpressure reduced this tenant's shared capacity weight.");
  } else if (tenant.backpressure.state === "throttled") {
    pressurePenalty *= 0.75;
    reasons.push("Throttled backpressure reduced this tenant's shared capacity weight.");
  }

  if (tenant.queuedReadyJobs <= 0) {
    reasons.push("Tenant has no ready queued work.");
  }
  if (requestedClaims <= 0 && tenant.queuedReadyJobs > 0) {
    reasons.push("Tenant has no concurrency headroom for additional claims.");
  }
  if (
    tenant.retryableFailuresInWindow >= tenant.quota.retryStormThreshold.limit ||
    tenant.replayQueuedJobs > Math.max(1, Math.floor(tenant.queuedJobs / 2))
  ) {
    pressurePenalty *= 0.5;
    reasons.push("Replay or retry storm pressure reduced this tenant's weight.");
  }

  const effectiveWeight = Math.max(0, tenant.quota.fairnessWeight * starvationBoost * pressurePenalty);

  return {
    ...tenant,
    requestedClaims,
    effectiveWeight,
    starvationBoost,
    pressurePenalty,
    reasons,
  };
}

function canGrant(tenant: FairnessWindowTenantState, grantedClaims: number): boolean {
  return tenant.requestedClaims > grantedClaims && tenant.effectiveWeight > 0;
}

function truncateWindow(now: string, windowDurationMs: number): string {
  const timestamp = Date.parse(now);
  const truncated = Math.floor(timestamp / windowDurationMs) * windowDurationMs;
  return new Date(truncated).toISOString();
}
