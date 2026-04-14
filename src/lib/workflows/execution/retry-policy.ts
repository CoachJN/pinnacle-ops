import type { IsoDateTimeString } from "@/types/entity";
import type { WorkflowOrchestrationActionType } from "../orchestration/index.ts";
import type {
  ScheduledWorkflowExecutionRecord,
  WorkflowExecutionFailureCode,
} from "./types.ts";

export interface WorkflowRetryPolicy {
  readonly maxAttempts: number;
  readonly retryableFailureCodes: readonly WorkflowExecutionFailureCode[];
  readonly baseDelayMinutes: number;
}

const DEFAULT_RETRY_POLICY: WorkflowRetryPolicy = {
  maxAttempts: 3,
  retryableFailureCodes: [
    "DISPATCH_FAILED",
    "PERSISTENCE_FAILED",
    "DEPENDENCY_UNAVAILABLE",
  ],
  baseDelayMinutes: 15,
};

const NON_RETRYABLE_POLICY: WorkflowRetryPolicy = {
  maxAttempts: 1,
  retryableFailureCodes: [],
  baseDelayMinutes: 0,
};

export function getWorkflowRetryPolicy(
  actionType: WorkflowOrchestrationActionType,
): WorkflowRetryPolicy {
  switch (actionType) {
    case "CREATE_FOLLOW_UP_TASK":
    case "CREATE_ESCALATION_RECORD":
    case "SCHEDULE_RECHECK":
    case "FLAG_ENTITY":
    case "REQUEST_INTERNAL_REVIEW":
    case "REQUEST_COLLECTION_REVIEW":
    case "REQUEST_QUOTE_FOLLOW_UP":
    case "REQUEST_CLIENT_APPROVAL_FOLLOW_UP":
      return DEFAULT_RETRY_POLICY;
    default:
      return NON_RETRYABLE_POLICY;
  }
}

export function isWorkflowExecutionFailureRetryable(input: {
  readonly action: ScheduledWorkflowExecutionRecord;
  readonly failureCode: WorkflowExecutionFailureCode;
  readonly nextAttemptCount: number;
}): boolean {
  const policy = getWorkflowRetryPolicy(input.action.actionType);
  const maxAttempts = input.action.maxAttempts ?? policy.maxAttempts;

  return (
    policy.retryableFailureCodes.includes(input.failureCode) &&
    input.nextAttemptCount < maxAttempts
  );
}

export function calculateNextRetryAt(input: {
  readonly action: ScheduledWorkflowExecutionRecord;
  readonly attemptCount: number;
  readonly errorCode: WorkflowExecutionFailureCode;
  readonly now?: IsoDateTimeString;
}): IsoDateTimeString | null {
  if (
    !isWorkflowExecutionFailureRetryable({
      action: input.action,
      failureCode: input.errorCode,
      nextAttemptCount: input.attemptCount,
    })
  ) {
    return null;
  }

  const policy = getWorkflowRetryPolicy(input.action.actionType);
  const multiplier = 2 ** Math.max(input.attemptCount - 1, 0);
  const now = new Date(input.now ?? new Date().toISOString());

  return new Date(
    now.getTime() + policy.baseDelayMinutes * multiplier * 60 * 1000,
  ).toISOString();
}
