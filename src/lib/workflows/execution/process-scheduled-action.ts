import type { EntityId, IsoDateTimeString } from "@/types/entity";
import {
  calculateNextRetryAt,
  isWorkflowExecutionFailureRetryable,
} from "./retry-policy.ts";
import type { WorkflowExecutionAdapters } from "./repositories.ts";
import type { ScheduledWorkflowExecutionStatusUpdate } from "./repositories.ts";
import type {
  ScheduledWorkflowExecutionRecord,
  ScheduledWorkflowExecutionStatus,
  WorkflowExecutionAttempt,
  WorkflowExecutionFailureCode,
  WorkflowExecutionResult,
  WorkflowExecutionWarning,
} from "./types.ts";

const SUPPORTED_ACTION_TYPES = new Set<string>([
  "CREATE_FOLLOW_UP_TASK",
  "CREATE_ESCALATION_RECORD",
  "SCHEDULE_RECHECK",
  "FLAG_ENTITY",
  "REQUEST_INTERNAL_REVIEW",
  "REQUEST_COLLECTION_REVIEW",
  "REQUEST_QUOTE_FOLLOW_UP",
  "REQUEST_CLIENT_APPROVAL_FOLLOW_UP",
]);

export async function processScheduledWorkflowAction(input: {
  readonly record: ScheduledWorkflowExecutionRecord;
  readonly workerId: EntityId;
  readonly now?: IsoDateTimeString;
  readonly adapters?: WorkflowExecutionAdapters;
}): Promise<WorkflowExecutionResult> {
  const now = input.now ?? new Date().toISOString();
  const attemptNumber = input.record.attemptCount + 1;
  const attemptBase: WorkflowExecutionAttempt = {
    attemptId: buildAttemptId(input.record.actionId, attemptNumber, now),
    actionId: input.record.actionId,
    workerId: input.workerId,
    attemptNumber,
    startedAt: now,
    status: "IN_PROGRESS",
  };
  const warnings: WorkflowExecutionWarning[] = [];

  const inProgress = await updateStatus(
    input.adapters,
    input.record,
    "IN_PROGRESS",
    {
      workerId: input.workerId,
      startedAt: now,
      attemptCount: attemptNumber,
      updatedAt: now,
    },
  );
  warnings.push(...inProgress);

  if (input.record.lifecycle === "quote") {
    return finishFailure({
      action: input.record,
      workerId: input.workerId,
      attempt: attemptBase,
      failureCode: "QUOTE_RUNTIME_DEFERRED",
      message:
        "Quote scheduled workflow execution is typed but runtime quote persistence remains deferred.",
      now,
      adapters: input.adapters,
      warnings,
      terminalStatus: "SKIPPED",
    });
  }

  if (!SUPPORTED_ACTION_TYPES.has(input.record.actionType)) {
    return finishFailure({
      action: input.record,
      workerId: input.workerId,
      attempt: attemptBase,
      failureCode: "UNSUPPORTED_ACTION_TYPE",
      message: "Scheduled workflow action type is not supported by the execution layer.",
      now,
      adapters: input.adapters,
      warnings,
      terminalStatus: "FAILED",
    });
  }

  if (!input.adapters?.executeScheduledWorkflowAction) {
    return finishFailure({
      action: input.record,
      workerId: input.workerId,
      attempt: attemptBase,
      failureCode: "DEPENDENCY_UNAVAILABLE",
      message:
        "No scheduled workflow action execution adapter is configured; durable action was not marked complete.",
      now,
      adapters: input.adapters,
      warnings,
    });
  }

  try {
    await input.adapters.executeScheduledWorkflowAction(input.record);
  } catch (error) {
    return finishFailure({
      action: input.record,
      workerId: input.workerId,
      attempt: attemptBase,
      failureCode: "DISPATCH_FAILED",
      message: "Scheduled workflow action execution failed.",
      now,
      adapters: input.adapters,
      warnings,
      error,
    });
  }

  const attempt: WorkflowExecutionAttempt = {
    ...attemptBase,
    status: "COMPLETED",
    finishedAt: now,
  };
  warnings.push(...(await recordAttempt(input.adapters, attempt)));
  warnings.push(
    ...(await updateStatus(input.adapters, input.record, "COMPLETED", {
      workerId: input.workerId,
      completedAt: now,
      attemptCount: attemptNumber,
      updatedAt: now,
    })),
  );

  return {
    actionId: input.record.actionId,
    ok: true,
    status: "COMPLETED",
    attempt,
    warnings,
  };
}

export async function processScheduledWorkflowActionById(input: {
  readonly actionId: EntityId;
  readonly workerId: EntityId;
  readonly now?: IsoDateTimeString;
  readonly adapters?: WorkflowExecutionAdapters;
}): Promise<WorkflowExecutionResult> {
  const action = await input.adapters?.getScheduledWorkflowExecutionById?.(
    input.actionId,
  );

  if (!action) {
    return {
      actionId: input.actionId,
      ok: false,
      status: "FAILED",
      failureCode: "ACTION_NOT_FOUND",
      warnings: [
        {
          code: "ACTION_NOT_FOUND",
          message: "Scheduled workflow execution was not found.",
          details: { actionId: input.actionId },
        },
      ],
    };
  }

  return processScheduledWorkflowAction({
    record: action,
    workerId: input.workerId,
    now: input.now,
    adapters: input.adapters,
  });
}

async function finishFailure(input: {
  readonly action: ScheduledWorkflowExecutionRecord;
  readonly workerId: EntityId;
  readonly attempt: WorkflowExecutionAttempt;
  readonly failureCode: WorkflowExecutionFailureCode;
  readonly message: string;
  readonly now: IsoDateTimeString;
  readonly adapters?: WorkflowExecutionAdapters;
  readonly warnings: WorkflowExecutionWarning[];
  readonly terminalStatus?: ScheduledWorkflowExecutionStatus;
  readonly error?: unknown;
}): Promise<WorkflowExecutionResult> {
  const nextAttemptCount = input.attempt.attemptNumber;
  const retryable = input.terminalStatus
    ? false
    : isWorkflowExecutionFailureRetryable({
        action: input.action,
        failureCode: input.failureCode,
        nextAttemptCount,
      });
  const nextRetryAt = retryable
    ? calculateNextRetryAt({
        action: input.action,
        attemptCount: nextAttemptCount,
        errorCode: input.failureCode,
        now: input.now,
      })
    : null;
  const status = input.terminalStatus ?? (retryable ? "RETRY_SCHEDULED" : "FAILED");
  const failureCode =
    status === "FAILED" &&
    input.failureCode !== "UNSUPPORTED_ACTION_TYPE" &&
    input.failureCode !== "QUOTE_RUNTIME_DEFERRED"
      ? "MAX_RETRIES_EXCEEDED"
      : input.failureCode;
  const warning: WorkflowExecutionWarning = {
    code: failureCode,
    message:
      failureCode === "MAX_RETRIES_EXCEEDED"
        ? "Scheduled workflow action exhausted its retry budget."
        : input.message,
    details: {
      actionId: input.action.actionId,
      actionType: input.action.actionType,
      originalFailureCode: input.failureCode,
      error: input.error instanceof Error ? input.error.message : undefined,
    },
  };

  const attempt: WorkflowExecutionAttempt = {
    ...input.attempt,
    status,
    finishedAt: input.now,
    errorCode: failureCode,
    message: warning.message,
  };
  input.warnings.push(warning);
  input.warnings.push(...(await recordAttempt(input.adapters, attempt)));
  input.warnings.push(
    ...(await updateStatus(input.adapters, input.action, status, {
      workerId: input.workerId,
      completedAt: status === "FAILED" || status === "SKIPPED" ? input.now : null,
      nextRetryAt,
      attemptCount: nextAttemptCount,
      errorCode: failureCode,
      message: warning.message,
      updatedAt: input.now,
    })),
  );

  return {
    actionId: input.action.actionId,
    ok: false,
    status,
    attempt,
    failureCode,
    warnings: input.warnings,
    nextRetryAt,
  };
}

async function updateStatus(
  adapters: WorkflowExecutionAdapters | undefined,
  action: ScheduledWorkflowExecutionRecord,
  status: ScheduledWorkflowExecutionStatus,
  update: Omit<ScheduledWorkflowExecutionStatusUpdate, "status">,
): Promise<readonly WorkflowExecutionWarning[]> {
  if (!adapters?.updateScheduledWorkflowExecutionStatus) {
    return [
      {
        code: "WORKFLOW_EXECUTION_REPOSITORY_UNAVAILABLE",
        message:
          "Scheduled workflow execution status update requires a durable repository.",
        details: { actionId: action.actionId, status },
      },
    ];
  }

  try {
    await adapters.updateScheduledWorkflowExecutionStatus(action.actionId, {
      status,
      ...update,
    });
    return [];
  } catch (error) {
    return [
      {
        code: "WORKFLOW_EXECUTION_UPDATE_FAILED",
        message: "Failed to update scheduled workflow execution status.",
        details: {
          actionId: action.actionId,
          status,
          error: error instanceof Error ? error.message : String(error),
        },
      },
    ];
  }
}

async function recordAttempt(
  adapters: WorkflowExecutionAdapters | undefined,
  attempt: WorkflowExecutionAttempt,
): Promise<readonly WorkflowExecutionWarning[]> {
  if (!adapters?.recordWorkflowExecutionAttempt) {
    return [];
  }

  try {
    await adapters.recordWorkflowExecutionAttempt(attempt);
    return [];
  } catch (error) {
    return [
      {
        code: "WORKFLOW_EXECUTION_ATTEMPT_RECORD_FAILED",
        message: "Failed to record scheduled workflow execution attempt.",
        details: {
          actionId: attempt.actionId,
          attemptNumber: attempt.attemptNumber,
          error: error instanceof Error ? error.message : String(error),
        },
      },
    ];
  }
}

function buildAttemptId(
  actionId: EntityId,
  attemptNumber: number,
  now: IsoDateTimeString,
): EntityId {
  return ["workflow-attempt", actionId, attemptNumber, now].join(":");
}
