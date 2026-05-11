export const RUNTIME_CLAIM_WORKER_HEALTH_STATES = {
  Idle: "idle",
  Active: "active",
  Recovering: "recovering",
  Expired: "expired",
} as const;

export type RuntimeClaimWorkerHealthState =
  (typeof RUNTIME_CLAIM_WORKER_HEALTH_STATES)[keyof typeof RUNTIME_CLAIM_WORKER_HEALTH_STATES];

export interface RuntimeWorkerHeartbeat {
  workerId: string;
  allocatorId: string;
  workerPoolId: string;
  shardIds: readonly string[];
  activeWindowKeys: readonly string[];
  activeClaimCount: number;
  healthState: RuntimeClaimWorkerHealthState;
  desiredConcurrency: number;
  maxConcurrency: number;
  heartbeatAt: string;
  leaseExpiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface RuntimeClaimRecoveryEvent {
  id: string;
  workerId: string;
  allocatorId: string;
  workerPoolId: string;
  shardIds: readonly string[];
  recoveryReason: "heartbeat_expired" | "lease_reassigned";
  detectedAt: string;
}
