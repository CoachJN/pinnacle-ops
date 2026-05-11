import "server-only";

import {
  RUNTIME_LOOP_EVENT_KINDS,
  RUNTIME_LOOP_HEARTBEAT_HEALTH,
  type RuntimeLoopEvent,
  type RuntimeLoopHeartbeat,
} from "../domain/runtime-loop-heartbeat";
import {
  RUNTIME_LOOP_STATUSES,
  type RuntimeLoop,
  type RuntimeLoopType,
} from "../domain/runtime-loop";
import type { RuntimeLoopService } from "./runtime-loop-service";
import type {
  RuntimeLoopEventRepository,
  RuntimeLoopRepository,
} from "./runtime-loop-repository";

export interface RuntimeLoopHeartbeatService {
  claimOwnership(input: {
    organizationId: string;
    loopType: RuntimeLoopType;
    leaseOwner: string;
    cadence: number;
    concurrencyLimit: number;
    correlationId?: string;
    now: string;
    leaseDurationMs: number;
  }): Promise<{
    acquired: boolean;
    recovered: boolean;
    loop: RuntimeLoop;
  }>;
  heartbeat(input: {
    organizationId: string;
    loopType: RuntimeLoopType;
    leaseOwner: string;
    now: string;
    leaseDurationMs: number;
  }): Promise<RuntimeLoop>;
  inspectHeartbeat(input: {
    organizationId: string;
    loopType: RuntimeLoopType;
    now: string;
  }): Promise<RuntimeLoopHeartbeat>;
}

export function createRuntimeLoopHeartbeatService(
  repository: RuntimeLoopRepository,
  loopService: RuntimeLoopService,
  events: RuntimeLoopEventRepository,
): RuntimeLoopHeartbeatService {
  return {
    async claimOwnership(input) {
      const claim = await repository.claimLoop({
        organizationId: input.organizationId,
        loopType: input.loopType,
        leaseOwner: input.leaseOwner,
        now: input.now,
        leaseDurationMs: input.leaseDurationMs,
        createDefault: () => ({
          id: `${input.organizationId}:${input.loopType}`,
          organizationId: input.organizationId,
          loopType: input.loopType,
          status: RUNTIME_LOOP_STATUSES.Starting,
          leaseOwner: input.leaseOwner,
          leaseExpiresAt: new Date(
            Date.parse(input.now) + input.leaseDurationMs,
          ).toISOString(),
          heartbeatAt: input.now,
          lastRunStartedAt: null,
          lastRunCompletedAt: null,
          cadence: input.cadence,
          concurrencyLimit: input.concurrencyLimit,
          failureCount: 0,
          lastError: null,
          correlationId:
            input.correlationId ??
            `runtime-loop:${input.organizationId}:${input.loopType}`,
          createdAt: input.now,
          updatedAt: input.now,
        }),
      });
      const next = await loopService.saveLoop({
        ...claim.loop,
        cadence: input.cadence,
        concurrencyLimit: input.concurrencyLimit,
        status: claim.acquired
          ? RUNTIME_LOOP_STATUSES.Starting
          : claim.loop.status,
        updatedAt: input.now,
      });
      if (claim.recovered) {
        await events.saveEvent(buildEvent(repository, {
          organizationId: input.organizationId,
          loopType: input.loopType,
          eventKind: RUNTIME_LOOP_EVENT_KINDS.Failover,
          leaseOwner: input.leaseOwner,
          previousLeaseOwner: claim.previousLeaseOwner,
          detectedAt: input.now,
          correlationId: next.correlationId,
          details: {
            recoveredLeaseExpiresAt: claim.loop.leaseExpiresAt,
          },
        }));
      }
      return {
        acquired: claim.acquired,
        recovered: claim.recovered,
        loop: next,
      };
    },
    async heartbeat(input) {
      const loop = await loopService.getLoop(input);
      if (!loop) {
        throw new Error(`Runtime loop ${input.loopType} was not initialized.`);
      }
      const next: RuntimeLoop = {
        ...loop,
        leaseOwner: input.leaseOwner,
        heartbeatAt: input.now,
        leaseExpiresAt: new Date(
          Date.parse(input.now) + input.leaseDurationMs,
        ).toISOString(),
        updatedAt: input.now,
      };
      return loopService.saveLoop(next);
    },
    async inspectHeartbeat(input) {
      const loop = await loopService.getLoop(input);
      if (!loop) {
        return {
          loopType: input.loopType,
          leaseOwner: null,
          heartbeatAt: null,
          leaseExpiresAt: null,
          health: RUNTIME_LOOP_HEARTBEAT_HEALTH.Missing,
        };
      }
      return {
        loopType: input.loopType,
        leaseOwner: loop.leaseOwner,
        heartbeatAt: loop.heartbeatAt,
        leaseExpiresAt: loop.leaseExpiresAt,
        health:
          loop.leaseExpiresAt && loop.leaseExpiresAt > input.now
            ? RUNTIME_LOOP_HEARTBEAT_HEALTH.Healthy
            : RUNTIME_LOOP_HEARTBEAT_HEALTH.Expired,
      };
    },
  };
}

function buildEvent(
  repository: Pick<RuntimeLoopRepository, "newEventId">,
  input: Omit<RuntimeLoopEvent, "id">,
): RuntimeLoopEvent {
  return {
    id: repository.newEventId(),
    ...input,
  };
}
