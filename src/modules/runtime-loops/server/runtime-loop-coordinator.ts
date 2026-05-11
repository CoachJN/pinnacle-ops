import "server-only";

import { nowIso } from "@/server/services/types";
import {
  RUNTIME_LOOP_RUN_STATUSES,
  type RuntimeLoopResult,
} from "../domain/runtime-loop-result";
import {
  RUNTIME_LOOP_STATUSES,
  type RuntimeLoopType,
} from "../domain/runtime-loop";
import type { RuntimeDrainService } from "./runtime-drain-service";
import type { RuntimeLoopHeartbeatService } from "./runtime-loop-heartbeat-service";
import type { RuntimeLoopService } from "./runtime-loop-service";
import type { RuntimeLoopRepository, RuntimeLoopResultRepository } from "./runtime-loop-repository";

export interface RuntimeLoopCycleMetrics {
  status: "succeeded" | "skipped" | "failed" | "noop";
  message?: string | null;
  processedCount?: number;
  enqueuedCount?: number;
  claimedCount?: number;
  duplicateCount?: number;
  replayNoopCount?: number;
  metadata?: Record<string, unknown>;
}

export interface RuntimeLoopCoordinator {
  runCycle(input: {
    organizationId: string;
    loopType: RuntimeLoopType;
    leaseOwner: string;
    cadence: number;
    concurrencyLimit: number;
    leaseDurationMs: number;
    correlationId?: string;
    now?: string;
    execute: () => Promise<RuntimeLoopCycleMetrics>;
  }): Promise<{
    acquired: boolean;
    loopStatus: "executed" | "paused" | "draining" | "duplicate_owner";
    result: RuntimeLoopResult;
  }>;
  runBoundedLoop(input: {
    iterations: number;
    cadenceMs: number;
    runCycle: (iteration: number) => Promise<void>;
    sleep?: (ms: number) => Promise<void>;
  }): Promise<void>;
}

export function createRuntimeLoopCoordinator(
  loopService: RuntimeLoopService,
  heartbeat: RuntimeLoopHeartbeatService,
  drain: RuntimeDrainService,
  results: RuntimeLoopResultRepository,
  ids: Pick<RuntimeLoopRepository, "newResultId">,
): RuntimeLoopCoordinator {
  return {
    async runCycle(input) {
      const startedAt = input.now ?? nowIso();
      await loopService.ensureLoop({
        organizationId: input.organizationId,
        loopType: input.loopType,
        cadence: input.cadence,
        concurrencyLimit: input.concurrencyLimit,
        correlationId: input.correlationId,
        now: startedAt,
      });

      if (
        await drain.isLoopPaused({
          organizationId: input.organizationId,
          loopType: input.loopType,
          now: startedAt,
        })
      ) {
        const loop = await loopService.updateLoopStatus({
          organizationId: input.organizationId,
          loopType: input.loopType,
          status: RUNTIME_LOOP_STATUSES.Paused,
          now: startedAt,
        });
        const result = await saveResult(results, ids, {
          organizationId: input.organizationId,
          loopType: input.loopType,
          status: RUNTIME_LOOP_RUN_STATUSES.Skipped,
          leaseOwner: loop.leaseOwner,
          runStartedAt: startedAt,
          runCompletedAt: startedAt,
          cadenceLagMs: 0,
          processedCount: 0,
          enqueuedCount: 0,
          claimedCount: 0,
          duplicateCount: 0,
          replayNoopCount: 0,
          correlationId: loop.correlationId,
          message: "Loop is paused by operator control.",
          metadata: { reason: "paused" },
          createdAt: startedAt,
          updatedAt: startedAt,
        });
        return { acquired: false, loopStatus: "paused", result };
      }

      const claim = await heartbeat.claimOwnership({
        organizationId: input.organizationId,
        loopType: input.loopType,
        leaseOwner: input.leaseOwner,
        cadence: input.cadence,
        concurrencyLimit: input.concurrencyLimit,
        correlationId: input.correlationId,
        now: startedAt,
        leaseDurationMs: input.leaseDurationMs,
      });
      if (!claim.acquired) {
        const result = await saveResult(results, ids, {
          organizationId: input.organizationId,
          loopType: input.loopType,
          status: RUNTIME_LOOP_RUN_STATUSES.Skipped,
          leaseOwner: claim.loop.leaseOwner,
          runStartedAt: startedAt,
          runCompletedAt: startedAt,
          cadenceLagMs: 0,
          processedCount: 0,
          enqueuedCount: 0,
          claimedCount: 0,
          duplicateCount: 1,
          replayNoopCount: 0,
          correlationId: claim.loop.correlationId,
          message: "Duplicate loop owner was denied the active lease.",
          metadata: { reason: "duplicate_owner" },
          createdAt: startedAt,
          updatedAt: startedAt,
        });
        return { acquired: false, loopStatus: "duplicate_owner", result };
      }

      const draining = await drain.isLoopDraining({
        organizationId: input.organizationId,
        loopType: input.loopType,
        now: startedAt,
      });

      await loopService.updateLoopStatus({
        organizationId: input.organizationId,
        loopType: input.loopType,
        status: draining
          ? RUNTIME_LOOP_STATUSES.Draining
          : RUNTIME_LOOP_STATUSES.Running,
        now: startedAt,
        leaseOwner: input.leaseOwner,
        lastRunStartedAt: startedAt,
        heartbeatAt: startedAt,
        leaseExpiresAt: new Date(
          Date.parse(startedAt) + input.leaseDurationMs,
        ).toISOString(),
        lastError: null,
      });

      if (draining) {
        const loop = await loopService.getLoop({
          organizationId: input.organizationId,
          loopType: input.loopType,
        });
        const completedAt = startedAt;
        const result = await saveResult(results, ids, {
          organizationId: input.organizationId,
          loopType: input.loopType,
          status: RUNTIME_LOOP_RUN_STATUSES.Skipped,
          leaseOwner: input.leaseOwner,
          runStartedAt: startedAt,
          runCompletedAt: completedAt,
          cadenceLagMs: 0,
          processedCount: 0,
          enqueuedCount: 0,
          claimedCount: 0,
          duplicateCount: 0,
          replayNoopCount: 0,
          correlationId: loop?.correlationId ?? input.correlationId ?? input.loopType,
          message: "Loop is draining and will not start new work.",
          metadata: { reason: "draining" },
          createdAt: startedAt,
          updatedAt: completedAt,
        });
        return { acquired: true, loopStatus: "draining", result };
      }

      try {
        const outcome = await input.execute();
        const completedAt = input.now ?? nowIso();
        await heartbeat.heartbeat({
          organizationId: input.organizationId,
          loopType: input.loopType,
          leaseOwner: input.leaseOwner,
          now: completedAt,
          leaseDurationMs: input.leaseDurationMs,
        });
        const loop = await loopService.updateLoopStatus({
          organizationId: input.organizationId,
          loopType: input.loopType,
          status:
            outcome.status === "failed"
              ? RUNTIME_LOOP_STATUSES.Failed
              : RUNTIME_LOOP_STATUSES.Running,
          now: completedAt,
          lastRunCompletedAt: completedAt,
          lastError:
            outcome.status === "failed" ? outcome.message ?? "Loop failed." : null,
          failureDelta: outcome.status === "failed" ? 1 : 0,
          heartbeatAt: completedAt,
          leaseExpiresAt: new Date(
            Date.parse(completedAt) + input.leaseDurationMs,
          ).toISOString(),
        });
        const lagMs =
          loop.lastRunStartedAt && loop.lastRunCompletedAt
            ? Math.max(
                0,
                Date.parse(loop.lastRunStartedAt) -
                  (Date.parse(loop.lastRunCompletedAt) + loop.cadence),
              )
            : 0;
        const result = await saveResult(results, ids, {
          organizationId: input.organizationId,
          loopType: input.loopType,
          status: toRunStatus(outcome.status),
          leaseOwner: input.leaseOwner,
          runStartedAt: startedAt,
          runCompletedAt: completedAt,
          cadenceLagMs: lagMs,
          processedCount: outcome.processedCount ?? 0,
          enqueuedCount: outcome.enqueuedCount ?? 0,
          claimedCount: outcome.claimedCount ?? 0,
          duplicateCount: outcome.duplicateCount ?? 0,
          replayNoopCount: outcome.replayNoopCount ?? 0,
          correlationId: loop.correlationId,
          message: outcome.message ?? null,
          metadata: outcome.metadata ?? {},
          createdAt: startedAt,
          updatedAt: completedAt,
        });
        return { acquired: true, loopStatus: "executed", result };
      } catch (error) {
        const completedAt = input.now ?? nowIso();
        const message =
          error instanceof Error ? error.message : "Unknown runtime loop failure.";
        const loop = await loopService.updateLoopStatus({
          organizationId: input.organizationId,
          loopType: input.loopType,
          status: RUNTIME_LOOP_STATUSES.Failed,
          now: completedAt,
          lastRunCompletedAt: completedAt,
          lastError: message,
          failureDelta: 1,
        });
        const result = await saveResult(results, ids, {
          organizationId: input.organizationId,
          loopType: input.loopType,
          status: RUNTIME_LOOP_RUN_STATUSES.Failed,
          leaseOwner: input.leaseOwner,
          runStartedAt: startedAt,
          runCompletedAt: completedAt,
          cadenceLagMs: 0,
          processedCount: 0,
          enqueuedCount: 0,
          claimedCount: 0,
          duplicateCount: 0,
          replayNoopCount: 0,
          correlationId: loop.correlationId,
          message,
          metadata: {},
          createdAt: startedAt,
          updatedAt: completedAt,
        });
        return { acquired: true, loopStatus: "executed", result };
      }
    },
    async runBoundedLoop(input) {
      const sleep = input.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));
      for (let index = 0; index < Math.max(1, input.iterations); index += 1) {
        await input.runCycle(index);
        if (index < input.iterations - 1 && input.cadenceMs > 0) {
          await sleep(input.cadenceMs);
        }
      }
    },
  };
}

function toRunStatus(status: RuntimeLoopCycleMetrics["status"]) {
  switch (status) {
    case "failed":
      return RUNTIME_LOOP_RUN_STATUSES.Failed;
    case "skipped":
      return RUNTIME_LOOP_RUN_STATUSES.Skipped;
    case "noop":
      return RUNTIME_LOOP_RUN_STATUSES.Noop;
    default:
      return RUNTIME_LOOP_RUN_STATUSES.Succeeded;
  }
}

async function saveResult(
  repository: RuntimeLoopResultRepository,
  ids: Pick<RuntimeLoopRepository, "newResultId">,
  input: Omit<RuntimeLoopResult, "id">,
): Promise<RuntimeLoopResult> {
  return repository.saveResult({
    ...input,
    id: ids.newResultId(),
  });
}
