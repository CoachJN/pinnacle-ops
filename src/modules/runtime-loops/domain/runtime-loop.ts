export const RUNTIME_LOOP_TYPES = {
  AllocatorExecution: "allocator.execution",
  SchedulerCadence: "scheduler.cadence",
  ProviderReconciliation: "provider.reconciliation",
  WorkerDaemon: "worker.daemon",
} as const;

export type RuntimeLoopType =
  (typeof RUNTIME_LOOP_TYPES)[keyof typeof RUNTIME_LOOP_TYPES];

export const RUNTIME_LOOP_STATUSES = {
  Starting: "starting",
  Running: "running",
  Paused: "paused",
  Draining: "draining",
  Stopped: "stopped",
  Failed: "failed",
} as const;

export type RuntimeLoopStatus =
  (typeof RUNTIME_LOOP_STATUSES)[keyof typeof RUNTIME_LOOP_STATUSES];

export interface RuntimeLoop {
  id: string;
  organizationId: string;
  loopType: RuntimeLoopType;
  status: RuntimeLoopStatus;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  heartbeatAt: string | null;
  lastRunStartedAt: string | null;
  lastRunCompletedAt: string | null;
  cadence: number;
  concurrencyLimit: number;
  failureCount: number;
  lastError: string | null;
  correlationId: string;
  createdAt: string;
  updatedAt: string;
}

export function buildRuntimeLoopId(input: {
  organizationId: string;
  loopType: RuntimeLoopType;
}): string {
  return `${input.organizationId}:${input.loopType}`;
}
