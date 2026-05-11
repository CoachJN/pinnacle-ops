import "server-only";

import {
  RUNTIME_CLAIM_WORKER_HEALTH_STATES,
  type RuntimeClaimRecoveryEvent,
  type RuntimeWorkerHeartbeat,
} from "../domain/runtime-worker-heartbeat";
import type {
  RuntimeClaimRecoveryRepository,
  RuntimeClaimWorkerRepository,
} from "./runtime-claim-repository";

export interface RuntimeWorkerHeartbeatService {
  heartbeat(input: {
    workerId: string;
    allocatorId: string;
    workerPoolId: string;
    shardIds: readonly string[];
    activeWindowKeys: readonly string[];
    activeClaimCount: number;
    desiredConcurrency: number;
    maxConcurrency: number;
    now: string;
    leaseDurationMs: number;
  }): Promise<RuntimeWorkerHeartbeat>;
  expireStaleWorkers(input: {
    allocatorId: string;
    workerPoolId: string;
    now: string;
  }): Promise<readonly RuntimeClaimRecoveryEvent[]>;
  listWorkers(): Promise<RuntimeWorkerHeartbeat[]>;
}

export function createRuntimeWorkerHeartbeatService(
  repository: RuntimeClaimWorkerRepository,
  recovery: RuntimeClaimRecoveryRepository,
): RuntimeWorkerHeartbeatService {
  return {
    async heartbeat(input) {
      const existing = await repository.getWorker(input.workerId);
      const next: RuntimeWorkerHeartbeat = {
        workerId: input.workerId,
        allocatorId: input.allocatorId,
        workerPoolId: input.workerPoolId,
        shardIds: [...input.shardIds].sort(),
        activeWindowKeys: [...input.activeWindowKeys].sort(),
        activeClaimCount: input.activeClaimCount,
        healthState: input.activeClaimCount > 0
          ? RUNTIME_CLAIM_WORKER_HEALTH_STATES.Active
          : RUNTIME_CLAIM_WORKER_HEALTH_STATES.Idle,
        desiredConcurrency: input.desiredConcurrency,
        maxConcurrency: input.maxConcurrency,
        heartbeatAt: input.now,
        leaseExpiresAt: new Date(Date.parse(input.now) + input.leaseDurationMs).toISOString(),
        createdAt: existing?.createdAt ?? input.now,
        updatedAt: input.now,
      };
      return repository.saveWorker(next);
    },
    async expireStaleWorkers(input) {
      const workers = await repository.listWorkers();
      const staleWorkers = workers.filter((worker) =>
        worker.allocatorId === input.allocatorId &&
        worker.workerPoolId === input.workerPoolId &&
        worker.leaseExpiresAt <= input.now &&
        worker.healthState !== RUNTIME_CLAIM_WORKER_HEALTH_STATES.Expired,
      );

      const events: RuntimeClaimRecoveryEvent[] = [];
      for (const worker of staleWorkers.sort((left, right) => left.workerId.localeCompare(right.workerId))) {
        await repository.saveWorker({
          ...worker,
          activeWindowKeys: [],
          activeClaimCount: 0,
          healthState: RUNTIME_CLAIM_WORKER_HEALTH_STATES.Expired,
          updatedAt: input.now,
        });
        const event: RuntimeClaimRecoveryEvent = {
          id: recovery.newRecoveryEventId(),
          workerId: worker.workerId,
          allocatorId: worker.allocatorId,
          workerPoolId: worker.workerPoolId,
          shardIds: worker.shardIds,
          recoveryReason: "heartbeat_expired",
          detectedAt: input.now,
        };
        await recovery.saveEvent(event);
        events.push(event);
      }

      return events;
    },
    listWorkers() {
      return repository.listWorkers();
    },
  };
}
