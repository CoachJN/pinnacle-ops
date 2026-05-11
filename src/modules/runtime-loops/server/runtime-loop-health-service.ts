import "server-only";

import type { RuntimeDiagnosticsService } from "@/modules/runtime/server/runtime-diagnostics-service";
import type { ProviderHealthService } from "@/modules/provider-runtime/server/provider-health-service";
import {
  RUNTIME_LOOP_HEARTBEAT_HEALTH,
  type RuntimeLoopHeartbeat,
} from "../domain/runtime-loop-heartbeat";
import { RUNTIME_LOOP_TYPES, type RuntimeLoopType } from "../domain/runtime-loop";
import type { RuntimeDrainService } from "./runtime-drain-service";
import type { RuntimeLoopHeartbeatService } from "./runtime-loop-heartbeat-service";
import type { RuntimeLoopService } from "./runtime-loop-service";
import type { RuntimeLoopResultRepository } from "./runtime-loop-repository";

export interface RuntimeLoopHealthService {
  getHealth(input: {
    organizationId: string;
    now: string;
  }): Promise<{
    status: "healthy" | "degraded" | "paused" | "draining";
    state: Awaited<ReturnType<RuntimeDrainService["getState"]>>;
    loops: readonly Awaited<ReturnType<RuntimeLoopService["listLoops"]>>[number][];
    heartbeats: readonly RuntimeLoopHeartbeat[];
    throughput: {
      processedCount: number;
      enqueuedCount: number;
      replayNoopCount: number;
    };
    queuePressure: {
      queuedCount: number;
      leasedCount: number;
      deadLetterCount: number;
      pendingReceiptCount: number;
    };
  }>;
}

export function createRuntimeLoopHealthService(
  loopService: RuntimeLoopService,
  heartbeat: RuntimeLoopHeartbeatService,
  drain: RuntimeDrainService,
  runtimeDiagnostics: RuntimeDiagnosticsService,
  providerHealth: ProviderHealthService,
  results: RuntimeLoopResultRepository,
): RuntimeLoopHealthService {
  return {
    async getHealth(input) {
      const [loops, state, runtime, provider, recentResults] = await Promise.all([
        loopService.listLoops({ organizationId: input.organizationId }),
        drain.getState(input),
        runtimeDiagnostics.getSummary({ organizationId: input.organizationId, limit: 25 }),
        providerHealth.getSummary({ organizationId: input.organizationId }),
        results.listRecentResults({ organizationId: input.organizationId, limit: 25 }),
      ]);
      const heartbeats = await Promise.all(
        Object.values(RUNTIME_LOOP_TYPES).map((loopType) =>
          heartbeat.inspectHeartbeat({
            organizationId: input.organizationId,
            loopType,
            now: input.now,
          }),
        ),
      );
      const heartbeatDegraded = heartbeats.some(
        (item) => item.health !== RUNTIME_LOOP_HEARTBEAT_HEALTH.Healthy,
      );
      const status = state.draining
        ? "draining"
        : state.paused
          ? "paused"
          : heartbeatDegraded
            ? "degraded"
            : "healthy";
      return {
        status,
        state,
        loops,
        heartbeats,
        throughput: {
          processedCount: recentResults.reduce(
            (sum, item) => sum + item.processedCount,
            0,
          ),
          enqueuedCount: recentResults.reduce(
            (sum, item) => sum + item.enqueuedCount,
            0,
          ),
          replayNoopCount: recentResults.reduce(
            (sum, item) => sum + item.replayNoopCount,
            0,
          ),
        },
        queuePressure: {
          queuedCount: runtime.ok ? runtime.value.queuedCount : 0,
          leasedCount: runtime.ok ? runtime.value.leasedCount : 0,
          deadLetterCount: runtime.ok ? runtime.value.deadLetterCount : 0,
          pendingReceiptCount: provider.ok ? provider.value.pendingReceiptCount : 0,
        },
      };
    },
  };
}
