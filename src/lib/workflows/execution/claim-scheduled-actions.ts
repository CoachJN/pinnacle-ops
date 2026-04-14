import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type {
  ClaimScheduledWorkflowActionsInput,
  WorkflowExecutionAdapters,
} from "./repositories.ts";
import type { WorkflowWorkerClaimResult } from "./types.ts";

export async function claimScheduledWorkflowActions(
  input: ClaimScheduledWorkflowActionsInput & {
    readonly adapters?: WorkflowExecutionAdapters;
  },
): Promise<WorkflowWorkerClaimResult> {
  if (!input.adapters?.claimScheduledWorkflowExecutions) {
    return {
      claimed: [],
      skippedCount: 0,
      warnings: [
        {
          code: "WORKFLOW_EXECUTION_REPOSITORY_UNAVAILABLE",
          message:
            "Scheduled workflow execution claiming requires a durable repository with atomic claim semantics.",
        },
      ],
    };
  }

  try {
    const claimed = await input.adapters.claimScheduledWorkflowExecutions({
      workerId: input.workerId,
      now: input.now,
      limit: input.limit,
      lifecycle: input.lifecycle,
      entityType: input.entityType,
      actionTypes: input.actionTypes,
    });

    return { claimed, skippedCount: 0, warnings: [] };
  } catch (error) {
    return {
      claimed: [],
      skippedCount: 0,
      warnings: [
        {
          code: "WORKFLOW_EXECUTION_CLAIM_FAILED",
          message: "Failed to claim scheduled workflow executions.",
          details: { error: error instanceof Error ? error.message : String(error) },
        },
      ],
    };
  }
}

export async function claimScheduledWorkflowActionById(input: {
  readonly actionId: EntityId;
  readonly workerId: EntityId;
  readonly now?: IsoDateTimeString;
  readonly adapters?: WorkflowExecutionAdapters;
}): Promise<WorkflowWorkerClaimResult> {
  if (!input.adapters?.claimScheduledWorkflowExecutionById) {
    return {
      claimed: [],
      skippedCount: 0,
      warnings: [
        {
          code: "WORKFLOW_EXECUTION_REPOSITORY_UNAVAILABLE",
          message:
            "Scheduled workflow execution claiming by id requires a durable repository with atomic claim semantics.",
        },
      ],
    };
  }

  try {
    const claimed = await input.adapters.claimScheduledWorkflowExecutionById(
      input.actionId,
      { workerId: input.workerId, now: input.now },
    );

    return {
      claimed: claimed ? [claimed] : [],
      skippedCount: claimed ? 0 : 1,
      warnings: claimed
        ? []
        : [
            {
              code: "CLAIM_CONFLICT",
              message: "Scheduled workflow execution could not be claimed.",
              details: { actionId: input.actionId },
            },
          ],
    };
  } catch (error) {
    return {
      claimed: [],
      skippedCount: 0,
      warnings: [
        {
          code: "WORKFLOW_EXECUTION_CLAIM_FAILED",
          message: "Failed to claim scheduled workflow execution by id.",
          details: {
            actionId: input.actionId,
            error: error instanceof Error ? error.message : String(error),
          },
        },
      ],
    };
  }
}
