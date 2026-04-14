import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { TransitionEventRecord } from "../audit/index.ts";
import type { PlatformRole } from "../rbac-transition/index.ts";
import type { TransitionLifecycle } from "../transition-engine/index.ts";

export type WorkflowOrchestrationTriggerType =
  | "TRANSITION_EVENT"
  | "CONDITION_CHECK";

export type WorkflowOrchestrationActionType =
  | "CREATE_FOLLOW_UP_TASK"
  | "CREATE_ESCALATION_RECORD"
  | "SCHEDULE_RECHECK"
  | "FLAG_ENTITY"
  | "REQUEST_INTERNAL_REVIEW"
  | "REQUEST_COLLECTION_REVIEW"
  | "REQUEST_QUOTE_FOLLOW_UP"
  | "REQUEST_CLIENT_APPROVAL_FOLLOW_UP";

export type WorkflowOrchestrationStatus =
  | "PENDING"
  | "SCHEDULED"
  | "COMPLETED"
  | "SKIPPED"
  | "FAILED"
  | "CANCELLED";

export type WorkflowOrchestrationSeverity =
  | "low"
  | "normal"
  | "high"
  | "critical";

export type WorkflowOrchestrationEntityType = TransitionEventRecord["entityType"];

export type WorkflowOrchestrationAssignedAudience =
  | {
      readonly type: "role";
      readonly roles: readonly PlatformRole[];
    }
  | {
      readonly type: "queue";
      readonly key: string;
    }
  | {
      readonly type: "actor";
      readonly actorUserId: EntityId;
    };

export interface WorkflowOrchestrationTrigger {
  readonly type: WorkflowOrchestrationTriggerType;
  readonly eventType?: TransitionEventRecord["eventType"];
  readonly conditionKey?: string;
}

export interface WorkflowOrchestrationCondition {
  readonly previousStatus?: string | readonly string[];
  readonly newStatus?: string | readonly string[];
  readonly metadataEquals?: Readonly<Record<string, unknown>>;
}

export interface WorkflowOrchestrationAction {
  readonly actionId: EntityId;
  readonly ruleKey: string;
  readonly triggerType: WorkflowOrchestrationTriggerType;
  readonly lifecycle: TransitionLifecycle;
  readonly entityType: WorkflowOrchestrationEntityType;
  readonly entityId: EntityId;
  readonly sourceEventType?: TransitionEventRecord["eventType"];
  readonly sourcePreviousStatus?: string;
  readonly sourceNewStatus?: string;
  readonly actionType: WorkflowOrchestrationActionType;
  readonly status: WorkflowOrchestrationStatus;
  readonly priority?: number;
  readonly severity?: WorkflowOrchestrationSeverity;
  readonly scheduledFor?: IsoDateTimeString | null;
  readonly assignedAudience?: WorkflowOrchestrationAssignedAudience;
  readonly targetRole?: PlatformRole;
  readonly targetQueue?: string;
  readonly message: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly createdAt: IsoDateTimeString;
}

export type WorkflowOrchestrationRecord = WorkflowOrchestrationAction;

export type WorkflowOrchestrationWarningCode =
  | "WORKFLOW_ORCHESTRATION_EVENT_UNAVAILABLE"
  | "WORKFLOW_ORCHESTRATION_REPOSITORY_UNAVAILABLE"
  | "WORKFLOW_ORCHESTRATION_PERSISTENCE_FAILED"
  | "WORKFLOW_ORCHESTRATION_DISPATCH_FAILED"
  | "WORKFLOW_ORCHESTRATION_QUOTE_RUNTIME_DEFERRED";

export interface WorkflowOrchestrationWarning {
  readonly code: WorkflowOrchestrationWarningCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface WorkflowOrchestrationResult {
  readonly ok: true;
  readonly event?: TransitionEventRecord;
  readonly matchedRuleCount: number;
  readonly createdActionCount: number;
  readonly deferredOrScheduledActionCount: number;
  readonly evaluatedActions: readonly WorkflowOrchestrationAction[];
  readonly persistedActions: readonly WorkflowOrchestrationRecord[];
  readonly warnings: readonly WorkflowOrchestrationWarning[];
}

export interface WorkflowOrchestrationConditionCheckInput {
  readonly triggerType: "CONDITION_CHECK";
  readonly lifecycle: TransitionLifecycle;
  readonly entityType: WorkflowOrchestrationEntityType;
  readonly entityId: EntityId;
  readonly conditionKey: string;
  readonly currentStatus?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly timestamp?: IsoDateTimeString;
}

export type WorkflowOrchestrationInput =
  | {
      readonly triggerType: "TRANSITION_EVENT";
      readonly event: TransitionEventRecord | null | undefined;
      readonly now?: IsoDateTimeString;
    }
  | WorkflowOrchestrationConditionCheckInput;

export type Awaitable<T> = T | Promise<T>;
