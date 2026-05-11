import "server-only";

import {
  buildRuntimeLoopId,
  RUNTIME_LOOP_STATUSES,
  type RuntimeLoop,
  type RuntimeLoopStatus,
  type RuntimeLoopType,
} from "../domain/runtime-loop";
import type { RuntimeLoopRepository } from "./runtime-loop-repository";

export interface RuntimeLoopService {
  ensureLoop(input: {
    organizationId: string;
    loopType: RuntimeLoopType;
    cadence: number;
    concurrencyLimit: number;
    correlationId?: string;
    now: string;
  }): Promise<RuntimeLoop>;
  listLoops(input: { organizationId: string }): Promise<readonly RuntimeLoop[]>;
  getLoop(input: {
    organizationId: string;
    loopType: RuntimeLoopType;
  }): Promise<RuntimeLoop | null>;
  saveLoop(loop: RuntimeLoop): Promise<RuntimeLoop>;
  updateLoopStatus(input: {
    organizationId: string;
    loopType: RuntimeLoopType;
    status: RuntimeLoopStatus;
    now: string;
    lastError?: string | null;
    lastRunStartedAt?: string | null;
    lastRunCompletedAt?: string | null;
    leaseOwner?: string | null;
    leaseExpiresAt?: string | null;
    heartbeatAt?: string | null;
    failureDelta?: number;
  }): Promise<RuntimeLoop>;
}

export function createRuntimeLoopService(
  repository: RuntimeLoopRepository,
): RuntimeLoopService {
  return {
    async ensureLoop(input) {
      const existing = await repository.getLoop(input);
      if (existing) {
        const updated: RuntimeLoop = {
          ...existing,
          cadence: input.cadence,
          concurrencyLimit: input.concurrencyLimit,
          correlationId: input.correlationId ?? existing.correlationId,
          updatedAt: input.now,
        };
        return repository.saveLoop(updated);
      }
      return repository.saveLoop({
        id: buildRuntimeLoopId(input),
        organizationId: input.organizationId,
        loopType: input.loopType,
        status: RUNTIME_LOOP_STATUSES.Stopped,
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
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
      });
    },
    listLoops(input) {
      return repository.listLoops(input);
    },
    getLoop(input) {
      return repository.getLoop(input);
    },
    saveLoop(loop) {
      return repository.saveLoop(loop);
    },
    async updateLoopStatus(input) {
      const existing = await repository.getLoop(input);
      const loop =
        existing ??
        (await this.ensureLoop({
          organizationId: input.organizationId,
          loopType: input.loopType,
          cadence: 60_000,
          concurrencyLimit: 1,
          now: input.now,
        }));
      return repository.saveLoop({
        ...loop,
        status: input.status,
        lastError:
          input.lastError === undefined ? loop.lastError : input.lastError,
        lastRunStartedAt:
          input.lastRunStartedAt === undefined
            ? loop.lastRunStartedAt
            : input.lastRunStartedAt,
        lastRunCompletedAt:
          input.lastRunCompletedAt === undefined
            ? loop.lastRunCompletedAt
            : input.lastRunCompletedAt,
        leaseOwner:
          input.leaseOwner === undefined ? loop.leaseOwner : input.leaseOwner,
        leaseExpiresAt:
          input.leaseExpiresAt === undefined
            ? loop.leaseExpiresAt
            : input.leaseExpiresAt,
        heartbeatAt:
          input.heartbeatAt === undefined ? loop.heartbeatAt : input.heartbeatAt,
        failureCount: Math.max(0, loop.failureCount + (input.failureDelta ?? 0)),
        updatedAt: input.now,
      });
    },
  };
}
