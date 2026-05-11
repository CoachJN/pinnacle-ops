import "server-only";

import type {
  AllocatorExecutionService,
  RuntimeClaimWindowRepository,
} from "@/modules/runtime-claim";
import type { RuntimeLoopCoordinator } from "./runtime-loop-coordinator";
import { RUNTIME_LOOP_TYPES } from "../domain/runtime-loop";

export interface AllocatorLoopRunner {
  runCycle(input: {
    organizationId: string;
    allocatorId: string;
    leaseOwner: string;
    workerPoolId: string;
    workerId: string;
    now?: string;
    cadence: number;
    concurrencyLimit: number;
    shardCount: number;
    totalCapacity: number;
    leaseDurationMs: number;
  }): ReturnType<RuntimeLoopCoordinator["runCycle"]>;
}

export function createAllocatorLoopRunner(
  coordinator: RuntimeLoopCoordinator,
  execution: AllocatorExecutionService,
): AllocatorLoopRunner {
  return {
    runCycle(input) {
      return coordinator.runCycle({
        organizationId: input.organizationId,
        loopType: RUNTIME_LOOP_TYPES.AllocatorExecution,
        leaseOwner: input.leaseOwner,
        cadence: input.cadence,
        concurrencyLimit: input.concurrencyLimit,
        leaseDurationMs: input.leaseDurationMs,
        now: input.now,
        execute: async () => {
          const result = await execution.materialize({
            allocatorId: input.allocatorId,
            leaseOwner: input.leaseOwner,
            workerPoolId: input.workerPoolId,
            workerId: input.workerId,
            now: input.now ?? new Date().toISOString(),
            shardCount: input.shardCount,
            totalCapacity: input.totalCapacity,
            leaseDurationMs: input.leaseDurationMs,
          });
          return {
            status: result.windows.length > 0 ? "succeeded" : "noop",
            message: `Allocator execution evaluated ${result.windows.length} claim windows.`,
            processedCount: result.windows.length,
            claimedCount: result.windows.reduce(
              (sum, window) => sum + window.claimedCount,
              0,
            ),
            duplicateCount: result.skippedShardIds.length,
            metadata: {
              recoveries: result.recoveries,
              skippedShardIds: result.skippedShardIds,
              boundedWorkers: result.scaling.boundedWorkers,
            },
          };
        },
      });
    },
  };
}
