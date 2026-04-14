import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type {
  WorkflowOrchestrationActionType,
  WorkflowOrchestrationAssignedAudience,
  WorkflowOrchestrationSeverity,
} from "../orchestration/index.ts";
import type { TransitionLifecycle } from "../transition-engine/index.ts";

export type ScheduledWorkflowExecutionStatus =
  | "PENDING"
  | "CLAIMED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "RETRY_SCHEDULED"
  | "FAILED"
  | "CANCELLED"
  | "SKIPPED";

export type WorkflowExecutionFailureCode =
  | "ACTION_NOT_FOUND"
  | "CLAIM_CONFLICT"
  | "UNSUPPORTED_ACTION_TYPE"
  | "DISPATCH_FAILED"
  | "PERSISTENCE_FAILED"
  | "MAX_RETRIES_EXCEEDED"
  | "DEPENDENCY_UNAVAILABLE"
  | "QUOTE_RUNTIME_DEFERRED";

export interface ScheduledWorkflowExecutionRecord {
  readonly actionId: EntityId;
  readonly ruleKey: string;
  readonly lifecycle: TransitionLifecycle;
  readonly entityType: "work-order" | "invoice" | "quote";
  readonly entityId: EntityId;
  readonly actionType: WorkflowOrchestrationActionType;
  readonly status: ScheduledWorkflowExecutionStatus;
  readonly priority?: number;
  readonly severity?: WorkflowOrchestrationSeverity;
  readonly scheduledFor?: IsoDateTimeString | null;
  readonly claimedByWorkerId?: EntityId | null;
  readonly claimedAt?: IsoDateTimeString | null;
  readonly startedAt?: IsoDateTimeString | null;
  readonly completedAt?: IsoDateTimeString | null;
  readonly nextRetryAt?: IsoDateTimeString | null;
  readonly attemptCount: number;
  readonly maxAttempts?: number;
  readonly assignedAudience?: WorkflowOrchestrationAssignedAudience;
  readonly targetQueue?: string;
  readonly message: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt?: IsoDateTimeString;
}

export interface WorkflowExecutionAttempt {
  readonly attemptId: EntityId;
  readonly actionId: EntityId;
  readonly workerId: EntityId;
  readonly attemptNumber: number;
  readonly startedAt: IsoDateTimeString;
  readonly finishedAt?: IsoDateTimeString;
  readonly status: ScheduledWorkflowExecutionStatus;
  readonly errorCode?: WorkflowExecutionFailureCode;
  readonly message?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type WorkflowExecutionWarningCode =
  | WorkflowExecutionFailureCode
  | "WORKFLOW_EXECUTION_REPOSITORY_UNAVAILABLE"
  | "WORKFLOW_EXECUTION_CLAIM_FAILED"
  | "WORKFLOW_EXECUTION_UPDATE_FAILED"
  | "WORKFLOW_EXECUTION_ATTEMPT_RECORD_FAILED";

export interface WorkflowExecutionWarning {
  readonly code: WorkflowExecutionWarningCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface WorkflowExecutionResult {
  readonly actionId: EntityId;
  readonly ok: boolean;
  readonly status: ScheduledWorkflowExecutionStatus;
  readonly attempt?: WorkflowExecutionAttempt;
  readonly failureCode?: WorkflowExecutionFailureCode;
  readonly warnings: readonly WorkflowExecutionWarning[];
  readonly nextRetryAt?: IsoDateTimeString | null;
}

export interface WorkflowWorkerClaimResult {
  readonly claimed: readonly ScheduledWorkflowExecutionRecord[];
  readonly skippedCount: number;
  readonly warnings: readonly WorkflowExecutionWarning[];
}

export interface WorkflowWorkerBatchResult {
  readonly workerId: EntityId;
  readonly claimedCount: number;
  readonly completedCount: number;
  readonly retriedCount: number;
  readonly failedCount: number;
  readonly skippedCount: number;
  readonly results: readonly WorkflowExecutionResult[];
  readonly warnings: readonly WorkflowExecutionWarning[];
}

export type Awaitable<T> = T | Promise<T>;
