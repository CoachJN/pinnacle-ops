import "server-only";

import type { RuntimeDiagnosticsService } from "@/modules/runtime/server/runtime-diagnostics-service";
import type { ProviderHealthService } from "@/modules/provider-runtime/server/provider-health-service";
import { RUNTIME_LOOP_HEARTBEAT_HEALTH } from "../domain/runtime-loop-heartbeat";
import type { RuntimeDrainService } from "./runtime-drain-service";
import type { RuntimeLoopHealthService } from "./runtime-loop-health-service";
import type { RuntimeLoopService } from "./runtime-loop-service";
import type {
  RuntimeLoopEventRepository,
  RuntimeLoopResultRepository,
} from "./runtime-loop-repository";

export interface RuntimeLoopDiagnosticsService {
  getDiagnostics(input: {
    organizationId: string;
    now: string;
  }): Promise<{
    health: Awaited<ReturnType<RuntimeLoopHealthService["getHealth"]>>;
    recentResults: Awaited<
      ReturnType<RuntimeLoopResultRepository["listRecentResults"]>
    >;
    recentEvents: Awaited<
      ReturnType<RuntimeLoopEventRepository["listRecentEvents"]>
    >;
    loopMetrics: Array<{
      loopType: string;
      status: string;
      leaseOwner: string | null;
      heartbeatHealth: string;
      cadenceLagMs: number;
      utilization: number;
      lastResultStatus: string | null;
    }>;
    runtimeThroughput: Awaited<
      ReturnType<RuntimeDiagnosticsService["getSummary"]>
    > extends { ok: true; value: infer TValue }
      ? TValue
      : unknown;
    providerPressure: Awaited<
      ReturnType<ProviderHealthService["getSummary"]>
    > extends { ok: true; value: infer TValue }
      ? TValue
      : unknown;
    drainState: Awaited<ReturnType<RuntimeDrainService["getState"]>>;
  }>;
}

export function createRuntimeLoopDiagnosticsService(
  health: RuntimeLoopHealthService,
  loopService: RuntimeLoopService,
  results: RuntimeLoopResultRepository,
  events: RuntimeLoopEventRepository,
  runtimeDiagnostics: RuntimeDiagnosticsService,
  providerHealth: ProviderHealthService,
  drain: RuntimeDrainService,
): RuntimeLoopDiagnosticsService {
  return {
    async getDiagnostics(input) {
      const [
        healthSummary,
        loops,
        recentResults,
        recentEvents,
        runtime,
        provider,
        drainState,
      ] = await Promise.all([
        health.getHealth(input),
        loopService.listLoops({ organizationId: input.organizationId }),
        results.listRecentResults({ organizationId: input.organizationId, limit: 50 }),
        events.listRecentEvents({ organizationId: input.organizationId, limit: 50 }),
        runtimeDiagnostics.getSummary({ organizationId: input.organizationId, limit: 25 }),
        providerHealth.getSummary({ organizationId: input.organizationId }),
        drain.getState(input),
      ]);

      return {
        health: healthSummary,
        recentResults,
        recentEvents,
        loopMetrics: loops.map((loop) => {
          const lastResult =
            recentResults.find((item) => item.loopType === loop.loopType) ?? null;
          const heartbeat =
            healthSummary.heartbeats.find((item) => item.loopType === loop.loopType) ??
            null;
          return {
            loopType: loop.loopType,
            status: loop.status,
            leaseOwner: loop.leaseOwner,
            heartbeatHealth:
              heartbeat?.health ?? RUNTIME_LOOP_HEARTBEAT_HEALTH.Missing,
            cadenceLagMs: Math.max(
              0,
              loop.lastRunCompletedAt
                ? Date.parse(input.now) -
                    (Date.parse(loop.lastRunCompletedAt) + loop.cadence)
                : 0,
            ),
            utilization:
              loop.concurrencyLimit > 0 && lastResult
                ? Number(
                    (
                      Math.min(lastResult.processedCount, loop.concurrencyLimit) /
                      loop.concurrencyLimit
                    ).toFixed(4),
                  )
                : 0,
            lastResultStatus: lastResult?.status ?? null,
          };
        }),
        runtimeThroughput: runtime.ok ? runtime.value : {
          queuedCount: 0,
          leasedCount: 0,
          failedCount: 0,
          deadLetterCount: 0,
          oldestQueuedJob: null,
          jobsByType: [],
          recentFailures: [],
        },
        providerPressure: provider.ok ? provider.value : {
          duplicateWebhookCount: 0,
          reconciliationFailures: 0,
          pendingReceiptCount: 0,
          providerDeliverySummaries: [],
        },
        drainState,
      };
    },
  };
}
