import type {
  ClaimScheduledWorkflowActionsInput,
  WorkflowExecutionAdapters,
} from "./repositories.ts";
import { claimScheduledWorkflowActions } from "./claim-scheduled-actions.ts";
import { processScheduledWorkflowAction } from "./process-scheduled-action.ts";
import type { WorkflowWorkerBatchResult } from "./types.ts";

export async function processScheduledWorkflowActionsBatch(
  input: ClaimScheduledWorkflowActionsInput & {
    readonly adapters?: WorkflowExecutionAdapters;
  },
): Promise<WorkflowWorkerBatchResult> {
  const claim = await claimScheduledWorkflowActions(input);
  const results = [];

  for (const action of claim.claimed) {
    results.push(
      await processScheduledWorkflowAction({
        record: action,
        workerId: input.workerId,
        now: input.now,
        adapters: input.adapters,
      }),
    );
  }

  return {
    workerId: input.workerId,
    claimedCount: claim.claimed.length,
    completedCount: results.filter((result) => result.status === "COMPLETED").length,
    retriedCount: results.filter((result) => result.status === "RETRY_SCHEDULED").length,
    failedCount: results.filter((result) => result.status === "FAILED").length,
    skippedCount:
      claim.skippedCount +
      results.filter((result) => result.status === "SKIPPED").length,
    results,
    warnings: [
      ...claim.warnings,
      ...results.flatMap((result) => result.warnings),
    ],
  };
}
