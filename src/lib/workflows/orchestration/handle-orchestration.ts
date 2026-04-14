import type { TransitionEventRecord } from "../audit/index.ts";
import { evaluateWorkflowOrchestrationRules } from "./evaluate-rules.ts";
import { persistWorkflowOrchestrationActions } from "./persist-orchestration-actions.ts";
import type { WorkflowOrchestrationRepository } from "./repositories.ts";
import type {
  Awaitable,
  WorkflowOrchestrationAction,
  WorkflowOrchestrationResult,
  WorkflowOrchestrationWarning,
} from "./types.ts";

export interface WorkflowOrchestrationAdapters extends WorkflowOrchestrationRepository {
  readonly dispatchWorkflowOrchestrationAction?: (
    action: WorkflowOrchestrationAction,
  ) => Awaitable<void>;
}

export async function handleWorkflowOrchestration(
  event: TransitionEventRecord | null | undefined,
  adapters: WorkflowOrchestrationAdapters = {},
): Promise<WorkflowOrchestrationResult> {
  const evaluation = evaluateWorkflowOrchestrationRules({
    triggerType: "TRANSITION_EVENT",
    event,
  });
  const persistence = await persistWorkflowOrchestrationActions({
    actions: evaluation.actions,
    repositories: adapters,
  });
  const dispatchWarnings = await dispatchImmediateActions(
    persistence.persistedActions,
    adapters,
  );

  return {
    ok: true,
    event: event ?? undefined,
    matchedRuleCount: evaluation.matchedRules.length,
    createdActionCount: persistence.persistedActions.length,
    deferredOrScheduledActionCount: persistence.persistedActions.filter(
      (action) => action.status === "SCHEDULED",
    ).length,
    evaluatedActions: evaluation.actions,
    persistedActions: persistence.persistedActions,
    warnings: [
      ...evaluation.warnings,
      ...persistence.warnings,
      ...dispatchWarnings,
    ],
  };
}

async function dispatchImmediateActions(
  actions: readonly WorkflowOrchestrationAction[],
  adapters: WorkflowOrchestrationAdapters,
): Promise<readonly WorkflowOrchestrationWarning[]> {
  if (!adapters.dispatchWorkflowOrchestrationAction) {
    return [];
  }

  const warnings: WorkflowOrchestrationWarning[] = [];
  const immediateActions = actions.filter((action) => action.status === "PENDING");

  for (const action of immediateActions) {
    try {
      await adapters.dispatchWorkflowOrchestrationAction(action);
    } catch (error) {
      warnings.push({
        code: "WORKFLOW_ORCHESTRATION_DISPATCH_FAILED",
        message: "Workflow orchestration action dispatch failed after durable persistence.",
        details: {
          actionId: action.actionId,
          ruleKey: action.ruleKey,
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  return warnings;
}
