import "server-only";

import type { DomainServices } from "@/server/services";
import type { WorkerRunnerService } from "@/modules/runtime/server/worker-runner-service";
import type { RuntimeLoopCoordinator } from "./runtime-loop-coordinator";
import { RUNTIME_LOOP_TYPES } from "../domain/runtime-loop";

export interface WorkerDaemonRunner {
  runCycle(input: {
    organizationId: string;
    leaseOwner: string;
    now?: string;
    cadence: number;
    concurrencyLimit: number;
    leaseDurationMs: number;
    heartbeatIntervalMs?: number | null;
    jobTypes?: readonly string[];
    services: DomainServices;
  }): ReturnType<RuntimeLoopCoordinator["runCycle"]>;
}

export function createWorkerDaemonRunner(
  coordinator: RuntimeLoopCoordinator,
  runner: WorkerRunnerService<DomainServices>,
): WorkerDaemonRunner {
  return {
    runCycle(input) {
      return coordinator.runCycle({
        organizationId: input.organizationId,
        loopType: RUNTIME_LOOP_TYPES.WorkerDaemon,
        leaseOwner: input.leaseOwner,
        cadence: input.cadence,
        concurrencyLimit: input.concurrencyLimit,
        leaseDurationMs: input.leaseDurationMs,
        now: input.now,
        execute: async () => {
          const batch = await runner.processPending({
            organizationId: input.organizationId,
            services: input.services,
            workerId: input.leaseOwner,
            now: input.now,
            maxJobs: input.concurrencyLimit,
            leaseDurationMs: input.leaseDurationMs,
            heartbeatIntervalMs: input.heartbeatIntervalMs ?? null,
            jobTypes: input.jobTypes,
          });
          if (!batch.ok) {
            throw new Error(batch.error.safeMessage);
          }
          return {
            status: batch.value.processedCount > 0 ? "succeeded" : "noop",
            message: `Worker daemon processed ${batch.value.processedCount} jobs.`,
            processedCount: batch.value.processedCount,
            claimedCount: batch.value.processedCount,
            duplicateCount: batch.value.duplicateCount,
            replayNoopCount: batch.value.duplicateCount,
            metadata: {
              completedCount: batch.value.completedCount,
              retryScheduledCount: batch.value.retryScheduledCount,
              deadLetteredCount: batch.value.deadLetteredCount,
            },
          };
        },
      });
    },
  };
}
