import { authorizeLifecycleTransition } from "../rbac-transition/index.ts";
import {
  buildTransitionAuditRecord,
  buildTransitionEventRecord,
  logTransitionAttempt,
  logTransitionSuccess,
  TRANSITION_AUDIT_OUTCOMES,
  type TransitionSideEffectWarning,
} from "../audit/index.ts";
import { handleWorkflowOrchestration } from "../orchestration/index.ts";
import {
  cancelWorkflowSlaTimersForEvent,
  createWorkflowSlaTimersFromEvent,
  satisfyWorkflowSlaTimersForEvent,
} from "../execution/index.ts";
import {
  normalizeWorkOrderStatusResult,
} from "../transition-engine/index.ts";
import { handleTransitionEvent } from "../reactions/index.ts";
import type { WorkOrderLifecycleStatus } from "../lifecycle/index.ts";
import { buildWorkOrderTransitionContext } from "./context-builders.ts";
import { transitionApplyFailure } from "./errors.ts";
import type { WorkOrderTransitionRepository } from "./repositories.ts";
import type {
  ApplyLifecycleTransitionInput,
  TransitionApplyResult,
  TransitionUpdateMetadata,
} from "./types.ts";

export async function applyWorkOrderTransition(
  input: ApplyLifecycleTransitionInput<"work-order">,
): Promise<TransitionApplyResult<"work-order">> {
  if (input.entityType !== "work-order" || input.lifecycle !== "work-order") {
    return withFailureAudit(input, transitionApplyFailure("INVALID_ENTITY_TYPE", {
      lifecycle: "work-order",
      entityType: input.entityType,
      entityId: input.entityId,
      to: input.to,
      message: "Work order transition service only supports work-order entities.",
    }));
  }

  if (!hasWorkOrderRepository(input.repositories)) {
    return withFailureAudit(input, transitionApplyFailure("UNSUPPORTED_RUNTIME_PATH", {
      lifecycle: "work-order",
      entityType: input.entityType,
      entityId: input.entityId,
      to: input.to,
      message: "Work order transition repository is not configured.",
    }));
  }

  const workOrder = await input.repositories.getWorkOrderById(input.entityId);
  if (!workOrder) {
    return withFailureAudit(input, transitionApplyFailure("ENTITY_NOT_FOUND", {
      lifecycle: "work-order",
      entityType: input.entityType,
      entityId: input.entityId,
      to: input.to,
      message: "Work order was not found.",
    }));
  }

  const fromStatus = normalizeWorkOrderStatusResult(workOrder.status);
  const toStatus = normalizeWorkOrderStatusResult(input.to);
  if (!fromStatus.ok) {
    return withFailureAudit(input, transitionApplyFailure("STATUS_MODEL_MISMATCH", {
      lifecycle: "work-order",
      entityType: input.entityType,
      entityId: input.entityId,
      from: workOrder.status,
      to: input.to,
      message: fromStatus.message,
      details: {
        field: "from",
        original: fromStatus.original,
      },
    }));
  }

  if (!toStatus.ok) {
    return withFailureAudit(input, transitionApplyFailure("STATUS_MODEL_MISMATCH", {
      lifecycle: "work-order",
      entityType: input.entityType,
      entityId: input.entityId,
      from: workOrder.status,
      to: input.to,
      message: toStatus.message,
      details: {
        field: "to",
        original: toStatus.original,
      },
    }));
  }

  const context = buildWorkOrderTransitionContext({
    workOrder,
    from: fromStatus.status,
    to: toStatus.status,
    contextOverrides: input.contextOverrides,
  });
  if (!context.ok) {
    return withFailureAudit(input, transitionApplyFailure("VALIDATION_FAILED", {
      lifecycle: "work-order",
      entityType: input.entityType,
      entityId: input.entityId,
      from: fromStatus.status,
      to: toStatus.status,
      message: context.message,
      details: context.details,
    }));
  }

  const authorizationResult = authorizeLifecycleTransition({
    lifecycle: "work-order",
    from: fromStatus.status,
    to: toStatus.status,
    actorType: input.actorType,
    role: input.role,
    context: context.context,
  });
  if (!authorizationResult.ok) {
    return withFailureAudit(input, {
      ok: false,
      failureCode: "AUTHORIZATION_FAILED",
      lifecycle: "work-order",
      entityType: input.entityType,
      entityId: input.entityId,
      from: fromStatus.status,
      to: toStatus.status,
      message: authorizationResult.message,
      authorizationResult,
    });
  }

  try {
    const updateResult = await input.repositories.updateWorkOrderStatus(
      input.entityId,
      toStatus.status,
      getUpdateMetadata(input),
    );
    const persistedStatus = normalizeWorkOrderStatusResult(
      getPersistedStatus(updateResult) ?? toStatus.status,
    );

    if (!persistedStatus.ok || persistedStatus.status !== toStatus.status) {
      return withFailureAudit(input, transitionApplyFailure("PERSISTENCE_FAILED", {
        lifecycle: "work-order",
        entityType: input.entityType,
        entityId: input.entityId,
        from: fromStatus.status,
        to: toStatus.status,
        message: persistedStatus.ok
          ? "Persisted work order status did not match requested transition target."
          : persistedStatus.message,
        details: {
          persistedStatus: persistedStatus.ok ? persistedStatus.status : null,
        },
      }));
    }

    return withSuccessAudit(input, {
      ok: true,
      lifecycle: "work-order",
      entityType: input.entityType,
      entityId: input.entityId,
      from: fromStatus.status,
      to: toStatus.status,
      persistedStatus: persistedStatus.status,
      message: `Work order transition ${fromStatus.status} -> ${toStatus.status} persisted.`,
      authorizationResult,
    });
  } catch (error) {
    return withFailureAudit(input, transitionApplyFailure("PERSISTENCE_FAILED", {
      lifecycle: "work-order",
      entityType: input.entityType,
      entityId: input.entityId,
      from: fromStatus.status,
      to: toStatus.status,
      message: "Failed to persist work order status transition.",
      details: { error: error instanceof Error ? error.message : String(error) },
    }));
  }
}

function hasWorkOrderRepository(
  repositories: ApplyLifecycleTransitionInput<"work-order">["repositories"],
): repositories is WorkOrderTransitionRepository {
  return Boolean(
    repositories?.getWorkOrderById && repositories.updateWorkOrderStatus,
  );
}

function getUpdateMetadata(
  input: ApplyLifecycleTransitionInput<"work-order">,
): TransitionUpdateMetadata {
  return {
    actorType: input.actorType,
    actorUserId: input.actorUserId,
    role: input.role,
    metadata: input.metadata,
  };
}

function getPersistedStatus(
  updateResult: Awaited<ReturnType<WorkOrderTransitionRepository["updateWorkOrderStatus"]>>,
): WorkOrderLifecycleStatus | string | undefined {
  return updateResult && "status" in updateResult ? updateResult.status : undefined;
}

async function withFailureAudit(
  input: ApplyLifecycleTransitionInput<"work-order">,
  result: Extract<TransitionApplyResult<"work-order">, { ok: false }>,
): Promise<TransitionApplyResult<"work-order">> {
  const timestamp = new Date().toISOString();
  const logging = await logTransitionAttempt({
    repositories: input.repositories,
    record: buildTransitionAuditRecord({
      lifecycle: "work-order",
      entityType: result.entityType,
      entityId: result.entityId,
      actorType: input.actorType,
      role: input.role,
      actorUserId: input.actorUserId,
      attemptedFromStatus: result.from,
      attemptedToStatus: result.to,
      finalOutcome:
        result.failureCode === "PERSISTENCE_FAILED"
          ? TRANSITION_AUDIT_OUTCOMES.Failed
          : TRANSITION_AUDIT_OUTCOMES.Rejected,
      failureCode: result.failureCode,
      message: result.message,
      authorizationFailureCode:
        result.authorizationResult && !result.authorizationResult.ok
          ? result.authorizationResult.failureCode
          : null,
      validationFailureCode: validationFailureCodeFrom(result),
      metadata: input.metadata,
      correlationId: getStringMetadata(input, "correlationId"),
      requestId: getStringMetadata(input, "requestId"),
      timestamp,
    }),
  });

  return withSideEffectWarnings(result, logging.warnings);
}

async function withSuccessAudit(
  input: ApplyLifecycleTransitionInput<"work-order">,
  result: Extract<TransitionApplyResult<"work-order">, { ok: true }>,
): Promise<TransitionApplyResult<"work-order">> {
  const timestamp = new Date().toISOString();
  const eventRecord = buildTransitionEventRecord({
    lifecycle: "work-order",
    entityType: result.entityType,
    entityId: result.entityId,
    previousStatus: result.from,
    newStatus: result.persistedStatus,
    actorType: input.actorType,
    role: input.role,
    actorUserId: input.actorUserId,
    metadata: input.metadata,
    timestamp,
  });
  const logging = await logTransitionSuccess({
    repositories: input.repositories,
    auditRecord: buildTransitionAuditRecord({
      lifecycle: "work-order",
      entityType: result.entityType,
      entityId: result.entityId,
      actorType: input.actorType,
      role: input.role,
      actorUserId: input.actorUserId,
      attemptedFromStatus: result.from,
      attemptedToStatus: result.to,
      finalOutcome: TRANSITION_AUDIT_OUTCOMES.Succeeded,
      message: result.message,
      metadata: input.metadata,
      correlationId: getStringMetadata(input, "correlationId"),
      requestId: getStringMetadata(input, "requestId"),
      timestamp,
    }),
    eventRecord,
  });

  if (!logging.eventRecorded) {
    return withSideEffectWarnings(result, logging.warnings);
  }

  const warnings: TransitionSideEffectWarning[] = [...logging.warnings];

  try {
    const reactions = await handleTransitionEvent(eventRecord, input.repositories);
    warnings.push(...reactions.warnings);
  } catch (error) {
    warnings.push({
      code: "TRANSITION_REACTION_HANDLER_FAILED",
      message: "Transition reaction handling failed after successful event recording.",
      details: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  try {
    const orchestration = await handleWorkflowOrchestration(
      eventRecord,
      input.repositories,
    );
    warnings.push(...orchestration.warnings);
  } catch (error) {
    warnings.push({
      code: "WORKFLOW_ORCHESTRATION_HANDLER_FAILED",
      message:
        "Workflow orchestration handling failed after successful event recording.",
      details: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  try {
    const satisfied = await satisfyWorkflowSlaTimersForEvent(
      eventRecord,
      input.repositories,
    );
    warnings.push(...satisfied.warnings);

    const cancelled = await cancelWorkflowSlaTimersForEvent(
      eventRecord,
      input.repositories,
    );
    warnings.push(...cancelled.warnings);

    const slaTimers = await createWorkflowSlaTimersFromEvent(
      eventRecord,
      input.repositories,
    );
    warnings.push(...slaTimers.warnings);
  } catch (error) {
    warnings.push({
      code: "WORKFLOW_SLA_HANDLER_FAILED",
      message:
        "Workflow SLA timer handling failed after successful event recording.",
      details: { error: error instanceof Error ? error.message : String(error) },
    });
  }

  return withSideEffectWarnings(result, warnings);
}

function validationFailureCodeFrom(
  result: Extract<TransitionApplyResult<"work-order">, { ok: false }>,
): string | null {
  if (result.validationResult && !result.validationResult.ok) {
    return result.validationResult.failureCode;
  }

  const lifecycleFailureCode = result.authorizationResult?.details?.lifecycleFailureCode;
  return typeof lifecycleFailureCode === "string" ? lifecycleFailureCode : null;
}

function getStringMetadata(
  input: ApplyLifecycleTransitionInput<"work-order">,
  key: "correlationId" | "requestId",
): string | undefined {
  const value = input.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function withSideEffectWarnings<TResult extends TransitionApplyResult<"work-order">>(
  result: TResult,
  warnings: readonly TransitionSideEffectWarning[],
): TResult {
  if (warnings.length === 0) {
    return result;
  }

  return { ...result, sideEffectWarnings: warnings };
}
