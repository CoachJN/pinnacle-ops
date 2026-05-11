import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { WorkerDeadLetterRecord, WorkerJob, WorkerJobErrorState, WorkerJobStatus } from "./worker-job";

export interface EnqueueWorkerJobInput<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  organizationId: EntityId;
  tenantId?: EntityId | null;
  type: string;
  payload: TPayload;
  payloadVersion: string;
  idempotencyKey: string;
  correlationId: string;
  causationId: string;
  sourceEventId?: EntityId | null;
  maxAttempts?: number;
  runAfter?: IsoDateTimeString | null;
}

export interface ClaimWorkerJobInput {
  organizationId: EntityId;
  workerId: string;
  leaseDurationMs: number;
  now: IsoDateTimeString;
  jobTypes?: readonly string[];
}

export interface ClaimWorkerJobByIdInput {
  organizationId: EntityId;
  tenantId?: EntityId | null;
  jobId: EntityId;
  workerId: string;
  leaseDurationMs: number;
  now: IsoDateTimeString;
}

export interface MarkWorkerJobRunningInput {
  organizationId: EntityId;
  jobId: EntityId;
  workerId: string;
  claimToken: string;
  now: IsoDateTimeString;
}

export interface CompleteWorkerJobInput {
  organizationId: EntityId;
  jobId: EntityId;
  workerId: string;
  claimToken: string;
  now: IsoDateTimeString;
}

export interface FailWorkerJobInput {
  organizationId: EntityId;
  jobId: EntityId;
  workerId: string;
  claimToken: string;
  now: IsoDateTimeString;
  error: WorkerJobErrorState;
}

export interface CancelWorkerJobInput {
  organizationId: EntityId;
  jobId: EntityId;
  now: IsoDateTimeString;
}

export interface ExtendWorkerLeaseInput {
  organizationId: EntityId;
  jobId: EntityId;
  workerId: string;
  claimToken: string;
  now: IsoDateTimeString;
  leaseDurationMs: number;
}

export interface ListWorkerJobsInput {
  organizationId: EntityId;
  status?: WorkerJobStatus | null;
  type?: string | null;
  limit?: number;
}

export interface WorkerJobCountsByType {
  type: string;
  count: number;
}

export interface WorkerFailureDiagnostic {
  jobId: EntityId;
  jobType: string;
  status: WorkerJobStatus | "dead_lettered";
  attemptCount: number;
  lastError: WorkerJobErrorState | null;
  deadLetterRecordId: EntityId | null;
  updatedAt: IsoDateTimeString;
}

export interface WorkerRuntimeDiagnostics {
  queuedCount: number;
  leasedCount: number;
  failedCount: number;
  deadLetterCount: number;
  oldestQueuedJob: WorkerJob | null;
  jobsByType: WorkerJobCountsByType[];
  recentFailures: WorkerFailureDiagnostic[];
}

export interface WorkerJobDetail {
  job: WorkerJob;
  deadLetter: WorkerDeadLetterRecord | null;
}
