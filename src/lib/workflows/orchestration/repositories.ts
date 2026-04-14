import type { EntityId } from "@/types/entity";
import type {
  Awaitable,
  WorkflowOrchestrationAction,
  WorkflowOrchestrationRecord,
  WorkflowOrchestrationStatus,
} from "./types.ts";

export interface WorkflowOrchestrationActionStatusUpdateDetails {
  readonly message?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly updatedAt?: string;
}

export interface ListPendingWorkflowOrchestrationActionsInput {
  readonly lifecycle?: WorkflowOrchestrationAction["lifecycle"];
  readonly entityType?: WorkflowOrchestrationAction["entityType"];
  readonly entityId?: EntityId;
  readonly status?: WorkflowOrchestrationStatus;
  readonly scheduledBefore?: string;
  readonly limit?: number;
}

export interface WorkflowOrchestrationRepository {
  readonly recordWorkflowOrchestrationAction?: (
    action: WorkflowOrchestrationAction,
  ) => Awaitable<WorkflowOrchestrationRecord | void>;
  readonly recordWorkflowOrchestrationActions?: (
    actions: readonly WorkflowOrchestrationAction[],
  ) => Awaitable<readonly WorkflowOrchestrationRecord[] | void>;
  readonly updateWorkflowOrchestrationActionStatus?: (
    actionId: EntityId,
    status: WorkflowOrchestrationStatus,
    details?: WorkflowOrchestrationActionStatusUpdateDetails,
  ) => Awaitable<WorkflowOrchestrationRecord | void>;
  readonly listPendingWorkflowOrchestrationActions?: (
    input?: ListPendingWorkflowOrchestrationActionsInput,
  ) => Awaitable<readonly WorkflowOrchestrationRecord[]>;
}
