import type {
  WorkflowOrchestrationActionType,
  WorkflowOrchestrationAssignedAudience,
  WorkflowOrchestrationCondition,
  WorkflowOrchestrationSeverity,
  WorkflowOrchestrationTrigger,
  WorkflowOrchestrationEntityType,
} from "./types.ts";
import type { TransitionLifecycle } from "../transition-engine/index.ts";

export type WorkflowOrchestrationDelayUnit = "minutes" | "hours" | "days";

export interface WorkflowOrchestrationDelay {
  readonly amount: number;
  readonly unit: WorkflowOrchestrationDelayUnit;
}

export interface WorkflowOrchestrationActionDefinition {
  readonly actionType: WorkflowOrchestrationActionType;
  readonly message: string;
  readonly assignedAudience?: WorkflowOrchestrationAssignedAudience;
  readonly targetQueue?: string;
  readonly delay?: WorkflowOrchestrationDelay;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface WorkflowOrchestrationRule {
  readonly ruleKey: string;
  readonly lifecycle: TransitionLifecycle;
  readonly entityType: WorkflowOrchestrationEntityType;
  readonly trigger: WorkflowOrchestrationTrigger;
  readonly conditions: WorkflowOrchestrationCondition;
  readonly enabled: boolean;
  readonly priority?: number;
  readonly severity?: WorkflowOrchestrationSeverity;
  readonly actions: readonly WorkflowOrchestrationActionDefinition[];
  readonly runtimeDeferred?: boolean;
  readonly description?: string;
}
