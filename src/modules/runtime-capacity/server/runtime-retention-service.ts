import "server-only";

import type { RuntimeRetentionPolicy } from "../domain/runtime-retention-policy";
import { DEFAULT_RUNTIME_RETENTION_POLICY } from "../domain/runtime-retention-policy";
import type { RuntimeCapacityDataSources, RuntimeQuotaService } from "./runtime-quota-service";

export interface RuntimeRetentionBucketSummary {
  totalCount: number;
  hotCount: number;
  archiveEligibleCount: number;
  purgeEligibleCount: number;
}

export interface RuntimeRetentionSummary {
  policy: RuntimeRetentionPolicy;
  projections: RuntimeRetentionBucketSummary;
  diagnosticsSnapshots: RuntimeRetentionBucketSummary;
  replayHistory: RuntimeRetentionBucketSummary;
  deadLetterHistory: RuntimeRetentionBucketSummary;
  providerReceiptHistory: RuntimeRetentionBucketSummary;
  deliveryAttemptHistory: RuntimeRetentionBucketSummary;
}

export interface RuntimeRetentionService {
  getSummary(input: {
    organizationId: string;
    tenantId?: string | null;
    now: string;
  }): Promise<RuntimeRetentionSummary>;
}

export function createRuntimeRetentionService(
  sources: RuntimeCapacityDataSources,
  quotaService: RuntimeQuotaService,
  policy: RuntimeRetentionPolicy = DEFAULT_RUNTIME_RETENTION_POLICY,
): RuntimeRetentionService {
  return {
    async getSummary(input) {
      const snapshot = await quotaService.buildSnapshot({
        organizationId: input.organizationId,
        tenantId: input.tenantId ?? input.organizationId,
        now: input.now,
      });
      const projectionAgeDays = snapshot.projectionGeneratedAt
        ? ageDays(snapshot.projectionGeneratedAt, input.now)
        : null;
      return {
        policy,
        projections: summarizeAges(
          projectionAgeDays === null ? [] : [projectionAgeDays],
          policy.runtimeProjections,
        ),
        diagnosticsSnapshots: summarizeAges(
          projectionAgeDays === null ? [] : [projectionAgeDays],
          policy.diagnosticsSnapshots,
        ),
        replayHistory: summarizeAges(
          snapshot.repairActions.map((item) => ageDays(item.requestedAt, input.now)),
          policy.replayHistory,
        ),
        deadLetterHistory: summarizeAges(
          snapshot.deadLetters.map((item) => ageDays(item.createdAt, input.now)),
          policy.deadLetterHistory,
        ),
        providerReceiptHistory: summarizeAges(
          snapshot.providerReceipts.map((item) => ageDays(item.receivedAt, input.now)),
          policy.providerReceiptHistory,
        ),
        deliveryAttemptHistory: summarizeAges(
          snapshot.deliveryAttempts.map((item) => ageDays(item.createdAt, input.now)),
          policy.deliveryAttemptHistory,
        ),
      };
    },
  };
}

function summarizeAges(
  agesInDays: readonly number[],
  policyWindow: RuntimeRetentionPolicy["runtimeProjections"],
): RuntimeRetentionBucketSummary {
  const purgeAfterDays = policyWindow.purgeAfterDays;
  return {
    totalCount: agesInDays.length,
    hotCount: agesInDays.filter((age) => age <= policyWindow.hotDays).length,
    archiveEligibleCount: agesInDays.filter((age) => age >= policyWindow.archiveAfterDays).length,
    purgeEligibleCount: purgeAfterDays === null ? 0 : agesInDays.filter((age) => age >= purgeAfterDays).length,
  };
}

function ageDays(timestamp: string, now: string): number {
  return Math.max(0, Math.floor((Date.parse(now) - Date.parse(timestamp)) / (24 * 60 * 60 * 1000)));
}
