import type { EntityId, IsoDateTimeString } from "@/types/entity";

export const WORKER_JOB_STATUSES = {
  Queued: "queued",
  Leased: "leased",
  Running: "running",
  Succeeded: "succeeded",
  Failed: "failed",
  DeadLettered: "dead_lettered",
  Cancelled: "cancelled",
} as const;

export type WorkerJobStatus =
  (typeof WORKER_JOB_STATUSES)[keyof typeof WORKER_JOB_STATUSES];

export interface WorkerJobErrorState {
  code: string | null;
  message: string;
  retryable: boolean;
  occurredAt: IsoDateTimeString;
  details: Record<string, unknown>;
}

export interface WorkerJobLeaseState {
  workerId: string | null;
  claimToken: string | null;
  leaseVersion: number;
  claimedAt: IsoDateTimeString | null;
  leaseExpiresAt: IsoDateTimeString | null;
  heartbeatAt: IsoDateTimeString | null;
  reclaimedAt: IsoDateTimeString | null;
  reclaimedBy: string | null;
  reclaimCount: number;
}

export interface WorkerJob<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  type: string;
  status: WorkerJobStatus;
  payload: TPayload;
  payloadVersion: string;
  idempotencyKey: string;
  correlationId: string;
  causationId: string;
  sourceEventId: EntityId | null;
  attemptCount: number;
  maxAttempts: number;
  runAfter: IsoDateTimeString;
  leasedBy: string | null;
  leaseExpiresAt: IsoDateTimeString | null;
  lease: WorkerJobLeaseState;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  lastError: WorkerJobErrorState | null;
  completedAt: IsoDateTimeString | null;
}

export interface WorkerDeadLetterRecord<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  originalJobId: EntityId;
  jobType: string;
  payloadSnapshot: TPayload | null;
  payloadReference: string | null;
  errorSummary: string;
  finalAttemptCount: number;
  correlationId: string;
  causationId: string;
  sourceEventId: EntityId | null;
  createdAt: IsoDateTimeString;
}
