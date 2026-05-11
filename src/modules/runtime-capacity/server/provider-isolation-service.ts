import "server-only";

import type { RuntimeCapacityAlert } from "../domain/runtime-capacity-alert";
import {
  inferProviderTypeFromJobType,
  isWithinWindow,
  type RuntimeCapacitySnapshot,
  type RuntimeQuotaService,
} from "./runtime-quota-service";

export interface ProviderIsolationState {
  providerType: string;
  state: "normal" | "throttled" | "isolated";
  failureCount: number;
  pendingCount: number;
  duplicateCount: number;
  reason: string | null;
}

export interface ProviderIsolationSummary {
  providerStates: readonly ProviderIsolationState[];
  isolatedProviders: readonly string[];
  throttledProviders: readonly string[];
  alerts: readonly RuntimeCapacityAlert[];
}

export interface ProviderIsolationService {
  getSummary(input: {
    organizationId: string;
    tenantId?: string | null;
    now: string;
  }): Promise<ProviderIsolationSummary>;
  shouldSuppressProviderJobRetry(input: {
    organizationId: string;
    tenantId?: string | null;
    jobType: string;
    now: string;
  }): Promise<boolean>;
}

export function createProviderIsolationService(quotaService: RuntimeQuotaService): ProviderIsolationService {
  return {
    async getSummary(input) {
      const snapshot = await quotaService.buildSnapshot({
        organizationId: input.organizationId,
        tenantId: input.tenantId ?? input.organizationId,
        now: input.now,
      });
      return summarizeProviderIsolation(snapshot, input.now);
    },
    async shouldSuppressProviderJobRetry(input) {
      const providerType = inferProviderTypeFromJobType(input.jobType);
      if (!providerType) {
        return false;
      }
      const summary = await this.getSummary(input);
      return summary.isolatedProviders.includes(providerType);
    },
  };
}

export function summarizeProviderIsolation(
  snapshot: RuntimeCapacitySnapshot,
  now: string,
): ProviderIsolationSummary {
  const providerMap = new Map<string, { failureCount: number; pendingCount: number; duplicateCount: number }>();
  for (const receipt of snapshot.providerReceipts) {
    const current = providerMap.get(receipt.providerType) ?? {
      failureCount: 0,
      pendingCount: 0,
      duplicateCount: 0,
    };
    if (
      (receipt.normalizedStatus === "failed" ||
        receipt.normalizedStatus === "bounced" ||
        receipt.normalizedStatus === "rejected") &&
      isWithinWindow(receipt.receivedAt, now, 15 * 60 * 1000)
    ) {
      current.failureCount += 1;
    }
    if (receipt.reconciliationStatus === "pending") {
      current.pendingCount += 1;
    }
    if (receipt.reconciliationStatus === "duplicate") {
      current.duplicateCount += 1;
    }
    providerMap.set(receipt.providerType, current);
  }

  const providerStates = [...providerMap.entries()]
    .map(([providerType, counts]) => {
      if (counts.failureCount >= 10 || counts.pendingCount >= 25) {
        return {
          providerType,
          state: "isolated",
          failureCount: counts.failureCount,
          pendingCount: counts.pendingCount,
          duplicateCount: counts.duplicateCount,
          reason: "Provider failure or backlog threshold exceeded for this tenant.",
        } satisfies ProviderIsolationState;
      }
      if (counts.failureCount >= 5 || counts.pendingCount >= 10 || counts.duplicateCount >= 5) {
        return {
          providerType,
          state: "throttled",
          failureCount: counts.failureCount,
          pendingCount: counts.pendingCount,
          duplicateCount: counts.duplicateCount,
          reason: "Provider pressure detected for this tenant.",
        } satisfies ProviderIsolationState;
      }
      return {
        providerType,
        state: "normal",
        failureCount: counts.failureCount,
        pendingCount: counts.pendingCount,
        duplicateCount: counts.duplicateCount,
        reason: null,
      } satisfies ProviderIsolationState;
    })
    .sort((left, right) => left.providerType.localeCompare(right.providerType));

  const alerts: RuntimeCapacityAlert[] = providerStates
    .filter((state) => state.state !== "normal")
    .map((state, index) => ({
      id: `provider-isolation:${snapshot.organizationId}:${state.providerType}:${index + 1}`,
      organizationId: snapshot.organizationId,
      tenantId: snapshot.tenantId,
      severity: state.state === "isolated" ? "critical" : "warning",
      category: "provider_isolation",
      summary:
        state.state === "isolated"
          ? `Provider ${state.providerType} is isolated for tenant runtime protection.`
          : `Provider ${state.providerType} is throttled for tenant runtime protection.`,
      observedAt: now,
      dimensions: {
        providerType: state.providerType,
        failureCount: state.failureCount,
        pendingCount: state.pendingCount,
        duplicateCount: state.duplicateCount,
      },
    }));

  return {
    providerStates,
    isolatedProviders: providerStates.filter((item) => item.state === "isolated").map((item) => item.providerType),
    throttledProviders: providerStates.filter((item) => item.state === "throttled").map((item) => item.providerType),
    alerts,
  };
}
