import "server-only";

import { createAllocatorLeaseService, createRuntimeAllocatorService, type RuntimeAllocatorGlobalRepository } from "@/modules/runtime-allocator";
import type { RuntimeClaimWindow } from "../domain/runtime-claim-window";
import type { RuntimeAllocationRecord } from "@/modules/runtime-allocator";
import type { RuntimeClaimBalancingSummary } from "./runtime-claim-balancer-service";
import type { RuntimeClaimService } from "./runtime-claim-service";
import type { RuntimeWorkerHeartbeatService } from "./runtime-worker-heartbeat-service";
import type { RuntimeWorkerScalingService } from "./runtime-worker-scaling-service";
import type { RuntimeClaimWindowRepository } from "./runtime-claim-repository";
import type { AllocatorLeaseService } from "@/modules/runtime-allocator";
import type { RuntimeClaimBalancerService } from "./runtime-claim-balancer-service";

export interface AllocatorExecutionResult {
  allocation: RuntimeAllocationRecord;
  windows: readonly RuntimeClaimWindow[];
  balancing: RuntimeClaimBalancingSummary;
  scaling: ReturnType<RuntimeWorkerScalingService["recommend"]>;
  recoveries: number;
  skippedShardIds: readonly string[];
}

export interface AllocatorExecutionService {
  materialize(input: {
    allocatorId: string;
    leaseOwner: string;
    workerPoolId: string;
    workerId: string;
    now: string;
    shardCount: number;
    totalCapacity: number;
    leaseDurationMs?: number;
  }): Promise<AllocatorExecutionResult>;
}

export function createAllocatorExecutionService(
  allocator: ReturnType<typeof createRuntimeAllocatorService>,
  leaseService: AllocatorLeaseService,
  balancer: RuntimeClaimBalancerService,
  claimService: RuntimeClaimService,
  heartbeat: RuntimeWorkerHeartbeatService,
  scaling: RuntimeWorkerScalingService,
  allocationRepository: RuntimeClaimWindowRepository,
): AllocatorExecutionService {
  return {
    async materialize(input) {
      const plan = await allocator.inspect({
        now: input.now,
        shardCount: input.shardCount,
        totalCapacity: input.totalCapacity,
      });
      const balancing = balancer.buildExecutionPlan(plan);
      const recoveries = (await heartbeat.expireStaleWorkers({
        allocatorId: input.allocatorId,
        workerPoolId: input.workerPoolId,
        now: input.now,
      })).length;
      const currentWorkers = await heartbeat.listWorkers();
      const scalingSnapshot = scaling.recommend({
        now: input.now,
        balancing,
        activeWorkers: currentWorkers.filter((worker) => worker.healthState !== "expired").length,
      });

      const windows: RuntimeClaimWindow[] = [];
      const skippedShardIds: string[] = [];
      for (const shard of plan.shardPlans) {
        const lease = await leaseService.claimShard({
          allocatorId: input.allocatorId,
          shardId: shard.shardId,
          leaseOwner: input.leaseOwner,
          now: input.now,
          leaseDurationMs: input.leaseDurationMs,
        });
        if (!lease.acquired) {
          skippedShardIds.push(shard.shardId);
          continue;
        }

        const shardWindows = [];
        for (const decision of balancing.orderedDecisions.filter((item) => item.shardId === shard.shardId)) {
          shardWindows.push(
            await claimService.materializeDecision({
              allocatorId: input.allocatorId,
              workerPoolId: input.workerPoolId,
              workerId: input.workerId,
              decision,
              now: input.now,
              leaseDurationMs: input.leaseDurationMs ?? 60_000,
            }),
          );
        }
        windows.push(...shardWindows);
      }

      await heartbeat.heartbeat({
        workerId: input.workerId,
        allocatorId: input.allocatorId,
        workerPoolId: input.workerPoolId,
        shardIds: windows.map((window) => window.shardId),
        activeWindowKeys: windows.map((window) => window.windowKey),
        activeClaimCount: windows.reduce((sum, window) => sum + window.claimedCount, 0),
        desiredConcurrency: scalingSnapshot.boundedWorkers,
        maxConcurrency: scalingSnapshot.boundedWorkers,
        now: input.now,
        leaseDurationMs: input.leaseDurationMs ?? 60_000,
      });

      return {
        allocation: {
          id: allocationRepository.newWindowId(),
          allocationKey: `${input.allocatorId}:${input.workerPoolId}:${input.workerId}:${input.now}`,
          allocatorId: input.allocatorId,
          shardId: windows[0]?.shardId ?? "none",
          workerPoolId: input.workerPoolId,
          workerId: input.workerId,
          status: windows.some((window) => window.claimedCount > 0) ? "claimed" : "planned",
          windowStartedAt: input.now,
          windowEndsAt: input.now,
          totalCapacity: input.totalCapacity,
          grantedCapacity: plan.grantedCapacity,
          claimedCapacity: windows.reduce((sum, window) => sum + window.claimedCount, 0),
          decisions: plan.shardPlans.flatMap((shard) => shard.decisions),
          claimedJobIds: windows.flatMap((window) => [...window.claimedJobIds]),
          createdAt: input.now,
          updatedAt: input.now,
        },
        windows,
        balancing,
        scaling: scalingSnapshot,
        recoveries,
        skippedShardIds,
      };
    },
  };
}
