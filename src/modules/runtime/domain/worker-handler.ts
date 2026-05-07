import type { WorkerExecutionOutcome } from "./worker-result";
import type { WorkerJob, WorkerJobErrorState } from "./worker-job";
import type { EntityId, IsoDateTimeString } from "@/types/entity";

export interface WorkerHandlerHeartbeat {
  extendLease(input?: {
    now?: IsoDateTimeString;
    leaseDurationMs?: number;
  }): Promise<WorkerJob>;
}

export interface WorkerHandlerContext<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
  TServices = unknown,
> {
  job: WorkerJob<TPayload>;
  payload: TPayload;
  organizationId: EntityId;
  correlationId: string;
  causationId: string;
  sourceEventId: EntityId | null;
  attemptCount: number;
  workerId: string;
  startedAt: IsoDateTimeString;
  services: TServices;
  heartbeat: WorkerHandlerHeartbeat;
}

export interface WorkerHandlerResult {
  success: boolean;
  message?: string;
  metadata?: Record<string, unknown>;
  retryable?: boolean;
  errorCode?: string | null;
  errorDetails?: Record<string, unknown>;
}

export interface WorkerHandlerDefinition<TServices = unknown> {
  type: string;
  description: string;
  handle: (
    context: WorkerHandlerContext<Record<string, unknown>, TServices>,
  ) => Promise<WorkerHandlerResult> | WorkerHandlerResult;
}

export interface RegisteredWorkerHandler {
  type: string;
  description: string;
}

export interface WorkerRunnerEligibleJob {
  jobId: EntityId;
  type: string;
  status: WorkerJob["status"];
  runAfter: IsoDateTimeString;
  leaseExpiresAt: IsoDateTimeString | null;
  attemptCount: number;
  maxAttempts: number;
  handlerRegistered: boolean;
}

export interface WorkerRunnerJobExecution {
  jobId: EntityId;
  jobType: string;
  attemptCount: number;
  outcome: WorkerExecutionOutcome;
  handlerRegistered: boolean;
  message: string | null;
  retryable: boolean | null;
  error: WorkerJobErrorState | null;
}

export interface WorkerRunnerBatchResult {
  workerId: string;
  processedCount: number;
  completedCount: number;
  retryScheduledCount: number;
  deadLetteredCount: number;
  duplicateCount: number;
  dryRun: boolean;
  eligibleJobs: readonly WorkerRunnerEligibleJob[];
  executions: readonly WorkerRunnerJobExecution[];
}

export interface RuntimeOperatorDiagnostics {
  registeredHandlers: readonly RegisteredWorkerHandler[];
  eligibleJobs: readonly WorkerRunnerEligibleJob[];
}
