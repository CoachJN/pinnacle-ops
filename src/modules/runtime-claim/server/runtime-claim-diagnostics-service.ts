import "server-only";

import type { AllocatorHealthService } from "@/modules/runtime-allocator";
import type { RuntimeClaimWindowRepository, RuntimeClaimRecoveryRepository } from "./runtime-claim-repository";
import type { RuntimeWorkerHeartbeatService } from "./runtime-worker-heartbeat-service";
import type { RuntimeWorkerScalingService } from "./runtime-worker-scaling-service";
import type { RuntimeClaimBalancerService } from "./runtime-claim-balancer-service";
import type { RuntimeAllocatorService } from "@/modules/runtime-allocator";

export interface RuntimeClaimDiagnosticsService {
  getHealth(input: {
    now: string;
    shardCount: number;
    totalCapacity: number;
  }): Promise<{
    allocatorHealth: Awaited<ReturnType<AllocatorHealthService["getHealth"]>>;
    workerCount: number;
    activeClaimCount: number;
    recoveries: number;
  }>;
  getDiagnostics(input: {
    now: string;
    shardCount: number;
    totalCapacity: number;
  }): Promise<{
    health: Awaited<ReturnType<RuntimeClaimDiagnosticsService["getHealth"]>>;
    workers: Awaited<ReturnType<RuntimeWorkerHeartbeatService["listWorkers"]>>;
    recentWindows: Awaited<ReturnType<RuntimeClaimWindowRepository["listRecentWindows"]>>;
    recoveryEvents: Awaited<ReturnType<RuntimeClaimRecoveryRepository["listRecentEvents"]>>;
    balancing: ReturnType<RuntimeClaimBalancerService["buildExecutionPlan"]>;
    scaling: ReturnType<RuntimeWorkerScalingService["recommend"]>;
  }>;
}

export function createRuntimeClaimDiagnosticsService(
  allocatorHealth: AllocatorHealthService,
  allocator: RuntimeAllocatorService,
  balancer: RuntimeClaimBalancerService,
  scaling: RuntimeWorkerScalingService,
  heartbeat: RuntimeWorkerHeartbeatService,
  windows: RuntimeClaimWindowRepository,
  recovery: RuntimeClaimRecoveryRepository,
): RuntimeClaimDiagnosticsService {
  return {
    async getHealth(input) {
      const [health, workers, recoveryEvents] = await Promise.all([
        allocatorHealth.getHealth({ now: input.now, shardCount: input.shardCount }),
        heartbeat.listWorkers(),
        recovery.listRecentEvents({ limit: 25 }),
      ]);
      return {
        allocatorHealth: health,
        workerCount: workers.length,
        activeClaimCount: workers.reduce((sum, worker) => sum + worker.activeClaimCount, 0),
        recoveries: recoveryEvents.length,
      };
    },
    async getDiagnostics(input) {
      const [plan, workers, recentWindows, recoveryEvents, health] = await Promise.all([
        allocator.inspect({
          now: input.now,
          shardCount: input.shardCount,
          totalCapacity: input.totalCapacity,
        }),
        heartbeat.listWorkers(),
        windows.listRecentWindows({ limit: 50 }),
        recovery.listRecentEvents({ limit: 50 }),
        this.getHealth(input),
      ]);
      const balancing = balancer.buildExecutionPlan(plan);
      const scalingSnapshot = scaling.recommend({
        now: input.now,
        balancing,
        activeWorkers: workers.filter((worker) => worker.healthState !== "expired").length,
      });

      return {
        health,
        workers,
        recentWindows,
        recoveryEvents,
        balancing,
        scaling: scalingSnapshot,
      };
    },
  };
}
