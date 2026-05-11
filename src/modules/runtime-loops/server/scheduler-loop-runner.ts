import "server-only";

import type { RuntimeSchedulerService } from "@/modules/scheduler/server/runtime-scheduler-service";
import type { RuntimeLoopCoordinator } from "./runtime-loop-coordinator";
import { RUNTIME_LOOP_TYPES } from "../domain/runtime-loop";

export interface SchedulerLoopRunner {
  runCycle(input: {
    organizationId: string;
    leaseOwner: string;
    now?: string;
    cadence: number;
    concurrencyLimit: number;
    leaseDurationMs: number;
    maxTasks?: number;
    dryRun?: boolean;
  }): ReturnType<RuntimeLoopCoordinator["runCycle"]>;
}

export function createSchedulerLoopRunner(
  coordinator: RuntimeLoopCoordinator,
  scheduler: RuntimeSchedulerService,
): SchedulerLoopRunner {
  return {
    runCycle(input) {
      return coordinator.runCycle({
        organizationId: input.organizationId,
        loopType: RUNTIME_LOOP_TYPES.SchedulerCadence,
        leaseOwner: input.leaseOwner,
        cadence: input.cadence,
        concurrencyLimit: input.concurrencyLimit,
        leaseDurationMs: input.leaseDurationMs,
        now: input.now,
        execute: async () => {
          const tick = await scheduler.tick({
            organizationId: input.organizationId,
            workerId: input.leaseOwner,
            now: input.now ?? new Date().toISOString(),
            maxTasks: input.maxTasks,
            leaseDurationMs: input.leaseDurationMs,
            dryRun: input.dryRun,
          });
          if (!tick.ok) {
            throw new Error(tick.error.safeMessage);
          }
          return {
            status: tick.value.enqueuedCount > 0 ? "succeeded" : "noop",
            message: `Scheduler cadence claimed ${tick.value.claimedTaskCount} tasks.`,
            processedCount: tick.value.claimedTaskCount,
            enqueuedCount: tick.value.enqueuedCount,
            duplicateCount: tick.value.existingCount + tick.value.rateLimitedCount,
            metadata: {
              dueTaskCount: tick.value.dueTaskCount,
              failedCount: tick.value.failedCount,
              rateLimitedCount: tick.value.rateLimitedCount,
            },
          };
        },
      });
    },
  };
}
