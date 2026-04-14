import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { TransitionEventRecord } from "../audit/index.ts";
import type { WorkflowOrchestrationActionType } from "../orchestration/index.ts";
import type { TransitionLifecycle } from "../transition-engine/index.ts";
import type {
  Awaitable,
  ScheduledWorkflowExecutionRecord,
  ScheduledWorkflowExecutionStatus,
  WorkflowExecutionAttempt,
} from "./types.ts";
import type {
  WorkflowSlaBreachRecord,
  WorkflowSlaStatus,
  WorkflowSlaTimer,
} from "./sla-types.ts";

export interface ClaimScheduledWorkflowActionsInput {
  readonly workerId: EntityId;
  readonly now?: IsoDateTimeString;
  readonly limit?: number;
  readonly lifecycle?: TransitionLifecycle;
  readonly entityType?: TransitionEventRecord["entityType"];
  readonly actionTypes?: readonly WorkflowOrchestrationActionType[];
}

export interface ScheduledWorkflowExecutionStatusUpdate {
  readonly status: ScheduledWorkflowExecutionStatus;
  readonly workerId?: EntityId;
  readonly startedAt?: IsoDateTimeString | null;
  readonly completedAt?: IsoDateTimeString | null;
  readonly nextRetryAt?: IsoDateTimeString | null;
  readonly errorCode?: string | null;
  readonly message?: string;
  readonly attemptCount?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly updatedAt?: IsoDateTimeString;
}

export interface ListWorkflowExecutionMonitoringInput {
  readonly now?: IsoDateTimeString;
  readonly lifecycle?: TransitionLifecycle;
  readonly entityType?: TransitionEventRecord["entityType"];
}

export interface WorkflowExecutionRepository {
  readonly claimScheduledWorkflowExecutions?: (
    input: ClaimScheduledWorkflowActionsInput,
  ) => Awaitable<readonly ScheduledWorkflowExecutionRecord[]>;
  readonly claimScheduledWorkflowExecutionById?: (
    actionId: EntityId,
    input: Omit<ClaimScheduledWorkflowActionsInput, "limit">,
  ) => Awaitable<ScheduledWorkflowExecutionRecord | null>;
  readonly getScheduledWorkflowExecutionById?: (
    actionId: EntityId,
  ) => Awaitable<ScheduledWorkflowExecutionRecord | null>;
  readonly updateScheduledWorkflowExecutionStatus?: (
    actionId: EntityId,
    update: ScheduledWorkflowExecutionStatusUpdate,
  ) => Awaitable<ScheduledWorkflowExecutionRecord | void>;
  readonly recordWorkflowExecutionAttempt?: (
    attempt: WorkflowExecutionAttempt,
  ) => Awaitable<WorkflowExecutionAttempt | void>;
  readonly listWorkflowExecutionsForMonitoring?: (
    input?: ListWorkflowExecutionMonitoringInput,
  ) => Awaitable<readonly ScheduledWorkflowExecutionRecord[]>;
}

export interface ListWorkflowSlaTimersInput {
  readonly now?: IsoDateTimeString;
  readonly lifecycle?: TransitionLifecycle;
  readonly entityType?: TransitionEventRecord["entityType"];
  readonly entityId?: EntityId;
}

export interface WorkflowSlaTimerStatusUpdate {
  readonly status: WorkflowSlaStatus;
  readonly satisfiedAt?: IsoDateTimeString | null;
  readonly updatedAt?: IsoDateTimeString;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface WorkflowSlaRepository {
  readonly recordWorkflowSlaTimer?: (
    timer: WorkflowSlaTimer,
  ) => Awaitable<WorkflowSlaTimer | void>;
  readonly recordWorkflowSlaTimers?: (
    timers: readonly WorkflowSlaTimer[],
  ) => Awaitable<readonly WorkflowSlaTimer[] | void>;
  readonly listActiveWorkflowSlaTimersDue?: (
    input?: ListWorkflowSlaTimersInput,
  ) => Awaitable<readonly WorkflowSlaTimer[]>;
  readonly listActiveWorkflowSlaTimersForEntity?: (
    input: Required<Pick<ListWorkflowSlaTimersInput, "lifecycle" | "entityType" | "entityId">>,
  ) => Awaitable<readonly WorkflowSlaTimer[]>;
  readonly updateWorkflowSlaTimerStatus?: (
    timerId: EntityId,
    update: WorkflowSlaTimerStatusUpdate,
  ) => Awaitable<WorkflowSlaTimer | void>;
  readonly recordWorkflowSlaBreach?: (
    breach: WorkflowSlaBreachRecord,
  ) => Awaitable<WorkflowSlaBreachRecord | void>;
  readonly listWorkflowSlaTimersForMonitoring?: (
    input?: ListWorkflowSlaTimersInput,
  ) => Awaitable<readonly WorkflowSlaTimer[]>;
  readonly listWorkflowSlaBreachesForMonitoring?: (
    input?: ListWorkflowSlaTimersInput,
  ) => Awaitable<readonly WorkflowSlaBreachRecord[]>;
}

export interface WorkflowExecutionAdapters
  extends WorkflowExecutionRepository,
    WorkflowSlaRepository {
  readonly executeScheduledWorkflowAction?: (
    action: ScheduledWorkflowExecutionRecord,
  ) => Awaitable<void>;
}
