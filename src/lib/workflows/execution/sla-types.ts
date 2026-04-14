import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { TransitionEventRecord } from "../audit/index.ts";
import type { TransitionLifecycle } from "../transition-engine/index.ts";

export type WorkflowSlaStatus =
  | "ACTIVE"
  | "SATISFIED"
  | "BREACHED"
  | "CANCELLED"
  | "EXPIRED";

export type WorkflowSlaBreachSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type WorkflowSlaRuntimePosture = "active" | "deferred";

export interface WorkflowSlaDefinition {
  readonly slaKey: string;
  readonly lifecycle: TransitionLifecycle;
  readonly entityType: TransitionEventRecord["entityType"];
  readonly startStatus: string;
  readonly defaultDurationHours: number;
  readonly breachSeverity: WorkflowSlaBreachSeverity;
  readonly purpose: string;
  readonly runtimePosture: WorkflowSlaRuntimePosture;
}

export interface WorkflowSlaTimer {
  readonly timerId: EntityId;
  readonly lifecycle: TransitionLifecycle;
  readonly entityType: TransitionEventRecord["entityType"];
  readonly entityId: EntityId;
  readonly slaKey: string;
  readonly startedAt: IsoDateTimeString;
  readonly dueAt: IsoDateTimeString;
  readonly satisfiedAt?: IsoDateTimeString | null;
  readonly status: WorkflowSlaStatus;
  readonly breachSeverity: WorkflowSlaBreachSeverity;
  readonly sourceStatus?: string;
  readonly sourceEvent?: EntityId | string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt?: IsoDateTimeString;
}

export interface WorkflowSlaBreachRecord {
  readonly breachId: EntityId;
  readonly timerId: EntityId;
  readonly lifecycle: TransitionLifecycle;
  readonly entityType: TransitionEventRecord["entityType"];
  readonly entityId: EntityId;
  readonly slaKey: string;
  readonly dueAt: IsoDateTimeString;
  readonly breachedAt: IsoDateTimeString;
  readonly severity: WorkflowSlaBreachSeverity;
  readonly sourceEvent?: EntityId | string | null;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export type WorkflowSlaWarningCode =
  | "WORKFLOW_SLA_REPOSITORY_UNAVAILABLE"
  | "WORKFLOW_SLA_TIMER_PERSISTENCE_FAILED"
  | "WORKFLOW_SLA_TIMER_UPDATE_FAILED"
  | "WORKFLOW_SLA_BREACH_PERSISTENCE_FAILED"
  | "WORKFLOW_SLA_QUOTE_RUNTIME_DEFERRED";

export interface WorkflowSlaWarning {
  readonly code: WorkflowSlaWarningCode;
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface WorkflowSlaCreationResult {
  readonly createdTimers: readonly WorkflowSlaTimer[];
  readonly deferredDefinitions: readonly WorkflowSlaDefinition[];
  readonly warnings: readonly WorkflowSlaWarning[];
}

export interface WorkflowSlaEvaluationResult {
  readonly evaluatedCount: number;
  readonly breachedCount: number;
  readonly satisfiedCount: number;
  readonly activeCount: number;
  readonly createdBreaches: readonly WorkflowSlaBreachRecord[];
  readonly warnings: readonly WorkflowSlaWarning[];
}
