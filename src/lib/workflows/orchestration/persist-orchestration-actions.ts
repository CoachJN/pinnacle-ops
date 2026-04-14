import type { WorkflowOrchestrationRepository } from "./repositories.ts";
import type {
  WorkflowOrchestrationAction,
  WorkflowOrchestrationRecord,
  WorkflowOrchestrationWarning,
} from "./types.ts";

export interface WorkflowOrchestrationPersistenceResult {
  readonly persistedActions: readonly WorkflowOrchestrationRecord[];
  readonly warnings: readonly WorkflowOrchestrationWarning[];
}

export async function persistWorkflowOrchestrationActions(input: {
  readonly actions: readonly WorkflowOrchestrationAction[];
  readonly repositories?: WorkflowOrchestrationRepository;
}): Promise<WorkflowOrchestrationPersistenceResult> {
  if (input.actions.length === 0) {
    return { persistedActions: [], warnings: [] };
  }

  if (input.repositories?.recordWorkflowOrchestrationActions) {
    try {
      const records = await input.repositories.recordWorkflowOrchestrationActions(
        input.actions,
      );
      return {
        persistedActions: records ?? input.actions,
        warnings: [],
      };
    } catch (error) {
      return {
        persistedActions: [],
        warnings: [
          {
            code: "WORKFLOW_ORCHESTRATION_PERSISTENCE_FAILED",
            message: "Failed to persist workflow orchestration actions.",
            details: { error: error instanceof Error ? error.message : String(error) },
          },
        ],
      };
    }
  }

  if (!input.repositories?.recordWorkflowOrchestrationAction) {
    return {
      persistedActions: [],
      warnings: [
        {
          code: "WORKFLOW_ORCHESTRATION_REPOSITORY_UNAVAILABLE",
          message:
            "Workflow orchestration actions were evaluated but no durable orchestration repository is configured.",
          details: { actionCount: input.actions.length },
        },
      ],
    };
  }

  const persistedActions: WorkflowOrchestrationRecord[] = [];
  const warnings: WorkflowOrchestrationWarning[] = [];

  for (const action of input.actions) {
    try {
      const record = await input.repositories.recordWorkflowOrchestrationAction(action);
      persistedActions.push(record ?? action);
    } catch (error) {
      warnings.push({
        code: "WORKFLOW_ORCHESTRATION_PERSISTENCE_FAILED",
        message: "Failed to persist workflow orchestration action.",
        details: {
          actionId: action.actionId,
          ruleKey: action.ruleKey,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  return { persistedActions, warnings };
}
