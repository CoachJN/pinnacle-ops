import "server-only";

import type { AllocatorExecutionResult, AllocatorExecutionService } from "./allocator-execution-service";

export interface AllocatorWorkerRunnerService {
  runOnce(input: {
    allocatorId: string;
    leaseOwner: string;
    workerPoolId: string;
    now: string;
    shardCount: number;
    totalCapacity: number;
    workerCount: number;
    leaseDurationMs?: number;
  }): Promise<readonly AllocatorExecutionResult[]>;
}

export function createAllocatorWorkerRunnerService(
  execution: AllocatorExecutionService,
): AllocatorWorkerRunnerService {
  return {
    async runOnce(input) {
      const runs: AllocatorExecutionResult[] = [];
      for (let index = 0; index < Math.max(1, input.workerCount); index += 1) {
        runs.push(
          await execution.materialize({
            allocatorId: input.allocatorId,
            leaseOwner: `${input.leaseOwner}-${index + 1}`,
            workerPoolId: input.workerPoolId,
            workerId: `${input.workerPoolId}-worker-${index + 1}`,
            now: input.now,
            shardCount: input.shardCount,
            totalCapacity: input.totalCapacity,
            leaseDurationMs: input.leaseDurationMs,
          }),
        );
      }
      return runs;
    },
  };
}
