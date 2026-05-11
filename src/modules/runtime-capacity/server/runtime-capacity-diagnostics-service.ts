import "server-only";

import type { RuntimeCapacityAlert } from "../domain/runtime-capacity-alert";
import type { RuntimeFairnessService } from "./runtime-fairness-service";
import type { RuntimeQuotaService } from "./runtime-quota-service";
import type { RuntimeBackpressureService } from "./runtime-backpressure-service";
import type { ProviderIsolationService } from "./provider-isolation-service";
import type { RuntimeRetentionService } from "./runtime-retention-service";
import type { RuntimeArchivalService } from "./runtime-archival-service";

export interface RuntimeCapacityDiagnosticsService {
  getDiagnostics(input: {
    organizationId: string;
    tenantId?: string | null;
    now: string;
  }): Promise<{
    tenantId: string;
    quota: ReturnType<RuntimeQuotaService["getQuota"]>;
    utilization: Awaited<ReturnType<RuntimeQuotaService["buildSnapshot"]>>["utilization"];
    fairness: ReturnType<RuntimeFairnessService["planAllocations"]>;
    backpressure: Awaited<ReturnType<RuntimeBackpressureService["evaluate"]>>;
    providerIsolation: Awaited<ReturnType<ProviderIsolationService["getSummary"]>>;
    retention: Awaited<ReturnType<RuntimeRetentionService["getSummary"]>>;
    archival: Awaited<ReturnType<RuntimeArchivalService["getSummary"]>>;
    alerts: readonly RuntimeCapacityAlert[];
    observabilityProtection: {
      topJobTypes: ReadonlyArray<{ type: string; count: number }>;
      diagnosticsPayloadLimited: true;
      highCardinalityDimensionsDropped: number;
    };
  }>;
}

export function createRuntimeCapacityDiagnosticsService(
  quota: RuntimeQuotaService,
  fairness: RuntimeFairnessService,
  backpressure: RuntimeBackpressureService,
  providerIsolation: ProviderIsolationService,
  retention: RuntimeRetentionService,
  archival: RuntimeArchivalService,
): RuntimeCapacityDiagnosticsService {
  return {
    async getDiagnostics(input) {
      const tenantId = input.tenantId ?? input.organizationId;
      const snapshot = await quota.buildSnapshot({
        organizationId: input.organizationId,
        tenantId,
        now: input.now,
      });
      const quotaPolicy = quota.getQuota({ tenantId });
      const fairnessPlan = fairness.planAllocations({
        totalCapacity: quotaPolicy.maxClaimBatchSize,
        tenants: [
          {
            tenantId,
            queuedJobs: snapshot.utilization.queuedRuntimeJobs,
            activeJobs: snapshot.utilization.activeRuntimeJobs,
            requestedClaims: Math.min(snapshot.utilization.queuedRuntimeJobs, quotaPolicy.maxClaimBatchSize),
            quota: quotaPolicy,
          },
        ],
      });
      const [backpressureState, providerSummary, retentionSummary, archivalSummary] = await Promise.all([
        backpressure.evaluate({
          organizationId: input.organizationId,
          tenantId,
          now: input.now,
        }),
        providerIsolation.getSummary({
          organizationId: input.organizationId,
          tenantId,
          now: input.now,
        }),
        retention.getSummary({
          organizationId: input.organizationId,
          tenantId,
          now: input.now,
        }),
        archival.getSummary({
          organizationId: input.organizationId,
          tenantId,
          now: input.now,
        }),
      ]);

      const jobTypeCounts = new Map<string, number>();
      for (const job of snapshot.jobs) {
        jobTypeCounts.set(job.type, (jobTypeCounts.get(job.type) ?? 0) + 1);
      }
      const topJobTypes = [...jobTypeCounts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 10)
        .map(([type, count]) => ({ type, count }));

      const alerts = limitAlerts([
        ...providerSummary.alerts,
        ...backpressureState.reasons.map((reason, index) => ({
          id: `backpressure:${tenantId}:${index + 1}`,
          organizationId: input.organizationId,
          tenantId,
          severity: backpressureState.state === "emergency" ? "critical" : "warning",
          category: "backpressure",
          summary: reason,
          observedAt: input.now,
          dimensions: {},
        })) satisfies RuntimeCapacityAlert[],
      ]);

      return {
        tenantId,
        quota: quotaPolicy,
        utilization: snapshot.utilization,
        fairness: fairnessPlan,
        backpressure: backpressureState,
        providerIsolation: {
          ...providerSummary,
          providerStates: providerSummary.providerStates.slice(0, 10),
        },
        retention: retentionSummary,
        archival: archivalSummary,
        alerts,
        observabilityProtection: {
          topJobTypes,
          diagnosticsPayloadLimited: true,
          highCardinalityDimensionsDropped: Math.max(0, jobTypeCounts.size - topJobTypes.length),
        },
      };
    },
  };
}

function limitAlerts(alerts: readonly RuntimeCapacityAlert[]): readonly RuntimeCapacityAlert[] {
  return alerts.slice(0, 20);
}
