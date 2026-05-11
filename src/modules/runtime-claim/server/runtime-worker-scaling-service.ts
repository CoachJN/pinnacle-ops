import "server-only";

import type { RuntimeClaimBalancingSummary } from "./runtime-claim-balancer-service";
import type { RuntimeWorkerScalingPolicy, RuntimeWorkerScalingSnapshot } from "../domain/runtime-worker-scaling";

export interface RuntimeWorkerScalingService {
  recommend(input: {
    now: string;
    balancing: RuntimeClaimBalancingSummary;
    activeWorkers: number;
    policy?: Partial<RuntimeWorkerScalingPolicy>;
  }): RuntimeWorkerScalingSnapshot;
}

const DEFAULT_POLICY: RuntimeWorkerScalingPolicy = {
  minWorkers: 1,
  maxWorkers: 4,
  maxClaimsPerWorker: 2,
};

export function createRuntimeWorkerScalingService(): RuntimeWorkerScalingService {
  return {
    recommend(input) {
      const policy = { ...DEFAULT_POLICY, ...input.policy };
      const totalGrantedClaims = input.balancing.orderedDecisions.reduce((sum, item) => sum + item.grantedClaims, 0);
      let desiredWorkers = Math.ceil(totalGrantedClaims / Math.max(1, policy.maxClaimsPerWorker));
      const reasoning: string[] = [];

      if (input.balancing.replayPressureTenants > 0) {
        desiredWorkers = Math.max(policy.minWorkers, desiredWorkers - 1);
        reasoning.push("Replay pressure attenuated worker expansion by one step.");
      }
      if (input.balancing.providerIsolatedTenants > 0) {
        desiredWorkers = Math.max(policy.minWorkers, desiredWorkers - input.balancing.providerIsolatedTenants);
        reasoning.push("Provider isolation reduced desired workers for deterministic containment.");
      }
      if (input.balancing.starvationProtectedTenants > 0) {
        desiredWorkers = Math.max(desiredWorkers, Math.min(policy.maxWorkers, input.balancing.starvationProtectedTenants));
        reasoning.push("Starvation-protected tenants raised the floor for active workers.");
      }

      const boundedWorkers = Math.min(policy.maxWorkers, Math.max(policy.minWorkers, desiredWorkers));
      if (boundedWorkers !== desiredWorkers) {
        reasoning.push("Desired workers were clamped to the configured min/max pool bounds.");
      }
      if (reasoning.length === 0) {
        reasoning.push("Worker pool matched granted claim demand within configured bounds.");
      }

      return {
        observedAt: input.now,
        desiredWorkers,
        boundedWorkers,
        activeWorkers: input.activeWorkers,
        totalGrantedClaims,
        replayPressureTenants: input.balancing.replayPressureTenants,
        providerIsolatedTenants: input.balancing.providerIsolatedTenants,
        reasoning,
      };
    },
  };
}
