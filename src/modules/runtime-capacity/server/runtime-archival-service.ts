import "server-only";

import type { RuntimeRetentionService } from "./runtime-retention-service";

export interface RuntimeArchivalSummary {
  archivableCounts: {
    projections: number;
    diagnosticsSnapshots: number;
    replayHistory: number;
    deadLetterHistory: number;
    providerReceiptHistory: number;
    deliveryAttemptHistory: number;
  };
  purgeEligibleCounts: {
    projections: number;
    diagnosticsSnapshots: number;
    replayHistory: number;
    deadLetterHistory: number;
    providerReceiptHistory: number;
    deliveryAttemptHistory: number;
  };
  preserveAuthoritativeOperationalHistory: boolean;
}

export interface RuntimeArchivalService {
  getSummary(input: {
    organizationId: string;
    tenantId?: string | null;
    now: string;
  }): Promise<RuntimeArchivalSummary>;
}

export function createRuntimeArchivalService(
  retention: RuntimeRetentionService,
): RuntimeArchivalService {
  return {
    async getSummary(input) {
      const summary = await retention.getSummary(input);
      return {
        archivableCounts: {
          projections: summary.projections.archiveEligibleCount,
          diagnosticsSnapshots: summary.diagnosticsSnapshots.archiveEligibleCount,
          replayHistory: summary.replayHistory.archiveEligibleCount,
          deadLetterHistory: summary.deadLetterHistory.archiveEligibleCount,
          providerReceiptHistory: summary.providerReceiptHistory.archiveEligibleCount,
          deliveryAttemptHistory: summary.deliveryAttemptHistory.archiveEligibleCount,
        },
        purgeEligibleCounts: {
          projections: summary.projections.purgeEligibleCount,
          diagnosticsSnapshots: summary.diagnosticsSnapshots.purgeEligibleCount,
          replayHistory: summary.replayHistory.purgeEligibleCount,
          deadLetterHistory: summary.deadLetterHistory.purgeEligibleCount,
          providerReceiptHistory: summary.providerReceiptHistory.purgeEligibleCount,
          deliveryAttemptHistory: summary.deliveryAttemptHistory.purgeEligibleCount,
        },
        preserveAuthoritativeOperationalHistory: summary.policy.preserveAuthoritativeOperationalHistory,
      };
    },
  };
}
