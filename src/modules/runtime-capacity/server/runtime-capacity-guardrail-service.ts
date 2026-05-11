import "server-only";

import type { RuntimeBackpressureService } from "./runtime-backpressure-service";
import type { ProviderIsolationService } from "./provider-isolation-service";
import {
  inferProviderTypeFromJobType,
  isProjectionRefreshRuntimeJobType,
  isRepairRuntimeJobType,
  isReplayRuntimeJobType,
  type RuntimeQuotaService,
} from "./runtime-quota-service";

export interface RuntimeCapacityGuardrailService {
  evaluateEnqueue(input: {
    organizationId: string;
    tenantId?: string | null;
    jobType: string;
    now: string;
  }): Promise<{ allowed: boolean; reason: string | null }>;
  getClaimBudget(input: {
    organizationId: string;
    tenantId?: string | null;
    now: string;
    requestedJobs: number;
  }): Promise<{ allowedMaxJobs: number; reason: string | null }>;
  getSchedulerBudget(input: {
    organizationId: string;
    tenantId?: string | null;
    taskType: string;
    now: string;
    requestedTasks: number;
  }): Promise<{ allowedMaxTasks: number; reason: string | null }>;
  evaluateRetrySuppression(input: {
    organizationId: string;
    tenantId?: string | null;
    jobType: string;
    now: string;
  }): Promise<{ suppress: boolean; reason: string | null }>;
}

export function createRuntimeCapacityGuardrailService(
  quota: RuntimeQuotaService,
  backpressure: RuntimeBackpressureService,
  providerIsolation: ProviderIsolationService,
): RuntimeCapacityGuardrailService {
  return {
    async evaluateEnqueue(input) {
      const quotaVerdict = await quota.evaluateEnqueue(input);
      if (!quotaVerdict.allowed) {
        return { allowed: false, reason: quotaVerdict.reason };
      }

      const backpressureState = await backpressure.evaluate(input);
      if (backpressureState.directive.queuePause) {
        return { allowed: false, reason: "Tenant runtime queue is paused by emergency backpressure." };
      }
      if (
        (isReplayRuntimeJobType(input.jobType) && !backpressureState.directive.replayAllowed) ||
        (isRepairRuntimeJobType(input.jobType) && !backpressureState.directive.repairAllowed)
      ) {
        return {
          allowed: false,
          reason: `Tenant runtime is ${backpressureState.state}; replay and repair intake is temporarily suppressed.`,
        };
      }

      const providerType = inferProviderTypeFromJobType(input.jobType);
      if (providerType) {
        const providerSummary = await providerIsolation.getSummary(input);
        if (providerSummary.isolatedProviders.includes(providerType)) {
          return {
            allowed: false,
            reason: `Provider ${providerType} is isolated for this tenant.`,
          };
        }
      }

      return { allowed: true, reason: null };
    },
    async getClaimBudget(input) {
      const tenantId = input.tenantId ?? input.organizationId;
      const quotaVerdict = await quota.evaluateClaim({
        organizationId: input.organizationId,
        tenantId,
        now: input.now,
      });
      if (!quotaVerdict.allowed) {
        return { allowedMaxJobs: 0, reason: quotaVerdict.reason };
      }

      const backpressureState = await backpressure.evaluate({
        organizationId: input.organizationId,
        tenantId,
        now: input.now,
      });
      const headroom = Math.max(
        0,
        quotaVerdict.quota.maxConcurrentRuntimeJobs - quotaVerdict.utilization.activeRuntimeJobs,
      );
      const requested = Math.max(0, input.requestedJobs);
      const quotaBound = Math.min(requested, quotaVerdict.quota.maxClaimBatchSize, headroom);
      const throttled = Math.floor(quotaBound * backpressureState.directive.claimBatchLimitFactor);
      const allowedMaxJobs =
        quotaBound > 0 && backpressureState.directive.claimBatchLimitFactor > 0
          ? Math.max(1, throttled)
          : throttled;
      return {
        allowedMaxJobs: Math.max(0, allowedMaxJobs),
        reason:
          allowedMaxJobs < requested
            ? `Claim throughput reduced because runtime is ${backpressureState.state}.`
            : null,
      };
    },
    async getSchedulerBudget(input) {
      const tenantId = input.tenantId ?? input.organizationId;
      const quotaPolicy = quota.getQuota({ tenantId });
      const backpressureState = await backpressure.evaluate({
        organizationId: input.organizationId,
        tenantId,
        now: input.now,
      });

      if (backpressureState.state === "emergency" && input.taskType !== "runtime.health.refresh") {
        return {
          allowedMaxTasks: 0,
          reason: "Scheduler paused non-health tasks while tenant runtime is in emergency mode.",
        };
      }
      if (
        backpressureState.state === "degraded" &&
        (isReplayRuntimeJobType(input.taskType) || input.taskType === "provider.reconciliation.sweep")
      ) {
        return {
          allowedMaxTasks: 0,
          reason: "Replay and reconciliation work paused while tenant runtime is degraded.",
        };
      }

      const quotaBound = Math.min(input.requestedTasks, quotaPolicy.maxSchedulerBatchSize);
      const throttled = Math.floor(quotaBound * backpressureState.directive.schedulerTaskLimitFactor);
      let allowedMaxTasks =
        quotaBound > 0 && backpressureState.directive.schedulerTaskLimitFactor > 0
          ? Math.max(1, throttled)
          : throttled;

      if (isProjectionRefreshRuntimeJobType(input.taskType)) {
        allowedMaxTasks = Math.min(allowedMaxTasks, 1);
      }

      return {
        allowedMaxTasks: Math.max(0, allowedMaxTasks),
        reason:
          allowedMaxTasks < input.requestedTasks
            ? `Scheduler throughput reduced because runtime is ${backpressureState.state}.`
            : null,
      };
    },
    evaluateRetrySuppression(input) {
      return backpressure.shouldSuppressRetry(input);
    },
  };
}
