import "server-only";

import { RUNTIME_BACKPRESSURE_STATES, type RuntimeBackpressureEvaluation, type RuntimeBackpressureState } from "../domain/runtime-backpressure";
import {
  inferProviderTypeFromJobType,
  isProviderRuntimeJobType,
  type RuntimeCapacitySnapshot,
  type RuntimeQuotaService,
} from "./runtime-quota-service";
import type { ProviderIsolationService } from "./provider-isolation-service";

export interface RuntimeBackpressureService {
  evaluate(input: {
    organizationId: string;
    tenantId?: string | null;
    now: string;
  }): Promise<RuntimeBackpressureEvaluation>;
  shouldSuppressRetry(input: {
    organizationId: string;
    tenantId?: string | null;
    jobType: string;
    now: string;
  }): Promise<{ suppress: boolean; reason: string | null }>;
}

export function createRuntimeBackpressureService(
  quotaService: RuntimeQuotaService,
  providerIsolation: ProviderIsolationService,
): RuntimeBackpressureService {
  return {
    async evaluate(input) {
      const snapshot = await quotaService.buildSnapshot({
        organizationId: input.organizationId,
        tenantId: input.tenantId ?? input.organizationId,
        now: input.now,
      });
      const quota = quotaService.getQuota({
        tenantId: input.tenantId ?? input.organizationId,
      });
      const providerSummary = await providerIsolation.getSummary(input);
      return evaluateBackpressureSnapshot(snapshot, quota, providerSummary);
    },
    async shouldSuppressRetry(input) {
      const evaluation = await this.evaluate(input);
      if (evaluation.directive.retrySuppressed) {
        return {
          suppress: true,
          reason: `Retries suppressed while runtime is ${evaluation.state}.`,
        };
      }
      if (isProviderRuntimeJobType(input.jobType)) {
        const providerType = inferProviderTypeFromJobType(input.jobType);
        if (providerType) {
          const providerSummary = await providerIsolation.getSummary(input);
          if (providerSummary.isolatedProviders.includes(providerType)) {
            return {
              suppress: true,
              reason: `Retries suppressed because provider ${providerType} is isolated.`,
            };
          }
        }
      }
      return { suppress: false, reason: null };
    },
  };
}

export function evaluateBackpressureSnapshot(
  snapshot: RuntimeCapacitySnapshot,
  quota: ReturnType<RuntimeQuotaService["getQuota"]>,
  providerSummary: Awaited<ReturnType<ProviderIsolationService["getSummary"]>>,
): RuntimeBackpressureEvaluation {
  const queuedRatio = ratio(snapshot.utilization.queuedRuntimeJobs, quota.maxQueuedJobs);
  const activeRatio = ratio(snapshot.utilization.activeRuntimeJobs, quota.maxConcurrentRuntimeJobs);
  const deadLetterRatio = ratio(snapshot.utilization.deadLetterCount, quota.deadLetterThreshold);
  const retryStorm = snapshot.utilization.retryableFailuresInWindow >= quota.retryStormThreshold.limit;
  const isolatedProvider = providerSummary.isolatedProviders.length > 0;
  const throttledProvider = providerSummary.throttledProviders.length > 0;

  const reasons: string[] = [];
  let state: RuntimeBackpressureState = RUNTIME_BACKPRESSURE_STATES.Normal;

  if (queuedRatio >= 1.5 || deadLetterRatio >= 2 || (retryStorm && activeRatio >= 1)) {
    state = RUNTIME_BACKPRESSURE_STATES.Emergency;
    reasons.push("Severe backlog or retry storm pressure detected.");
  } else if (queuedRatio >= 1 || activeRatio >= 1 || retryStorm || isolatedProvider) {
    state = RUNTIME_BACKPRESSURE_STATES.Degraded;
    reasons.push("Tenant runtime quota or provider isolation threshold exceeded.");
  } else if (queuedRatio >= 0.75 || activeRatio >= 0.75 || deadLetterRatio >= 0.75 || throttledProvider) {
    state = RUNTIME_BACKPRESSURE_STATES.Throttled;
    reasons.push("Tenant runtime is approaching capacity limits.");
  }

  if (isolatedProvider) {
    reasons.push("Provider isolation is active.");
  }
  if (retryStorm) {
    reasons.push("Retry storm threshold exceeded.");
  }

  switch (state) {
    case RUNTIME_BACKPRESSURE_STATES.Emergency:
      return {
        state,
        reasons,
        directive: {
          claimBatchLimitFactor: 0,
          schedulerTaskLimitFactor: 0,
          replayAllowed: false,
          repairAllowed: false,
          retrySuppressed: true,
          queuePause: true,
        },
      };
    case RUNTIME_BACKPRESSURE_STATES.Degraded:
      return {
        state,
        reasons,
        directive: {
          claimBatchLimitFactor: 0.25,
          schedulerTaskLimitFactor: 0.25,
          replayAllowed: false,
          repairAllowed: false,
          retrySuppressed: true,
          queuePause: false,
        },
      };
    case RUNTIME_BACKPRESSURE_STATES.Throttled:
      return {
        state,
        reasons,
        directive: {
          claimBatchLimitFactor: 0.5,
          schedulerTaskLimitFactor: 0.5,
          replayAllowed: true,
          repairAllowed: true,
          retrySuppressed: false,
          queuePause: false,
        },
      };
    default:
      return {
        state,
        reasons,
        directive: {
          claimBatchLimitFactor: 1,
          schedulerTaskLimitFactor: 1,
          replayAllowed: true,
          repairAllowed: true,
          retrySuppressed: false,
          queuePause: false,
        },
      };
  }
}

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }
  return numerator / denominator;
}
