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
  normalizeInvoiceStatusResult,
} from "../transition-engine/index.ts";
import { handleTransitionEvent } from "../reactions/index.ts";
import type { InvoiceLifecycleStatus } from "../lifecycle/index.ts";
import { buildInvoiceTransitionContext } from "./context-builders.ts";
import { transitionApplyFailure } from "./errors.ts";
import type { InvoiceTransitionRepository } from "./repositories.ts";
import type {
  ApplyLifecycleTransitionInput,
  TransitionApplyResult,
  TransitionUpdateMetadata,
} from "./types.ts";

export async function applyInvoiceTransition(
  input: ApplyLifecycleTransitionInput<"invoice">,
): Promise<TransitionApplyResult<"invoice">> {
  if (input.entityType !== "invoice" || input.lifecycle !== "invoice") {
    return withFailureAudit(input, transitionApplyFailure("INVALID_ENTITY_TYPE", {
      lifecycle: "invoice",
      entityType: input.entityType,
      entityId: input.entityId,
      to: input.to,
      message: "Invoice transition service only supports invoice entities.",
    }));
  }

  if (!hasInvoiceRepository(input.repositories)) {
    return withFailureAudit(input, transitionApplyFailure("UNSUPPORTED_RUNTIME_PATH", {
      lifecycle: "invoice",
      entityType: input.entityType,
      entityId: input.entityId,
      to: input.to,
      message: "Invoice transition repository is not configured.",
    }));
  }

  const invoice = await input.repositories.getInvoiceById(input.entityId);
  if (!invoice) {
    return withFailureAudit(input, transitionApplyFailure("ENTITY_NOT_FOUND", {
      lifecycle: "invoice",
      entityType: input.entityType,
      entityId: input.entityId,
      to: input.to,
      message: "Invoice was not found.",
    }));
  }

  const fromStatus = normalizeInvoiceStatusResult(invoice.status);
  const toStatus = normalizeInvoiceStatusResult(input.to);
  if (!fromStatus.ok) {
    return withFailureAudit(input, transitionApplyFailure("STATUS_MODEL_MISMATCH", {
      lifecycle: "invoice",
      entityType: input.entityType,
      entityId: input.entityId,
      from: invoice.status,
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
      lifecycle: "invoice",
      entityType: input.entityType,
      entityId: input.entityId,
      from: invoice.status,
      to: input.to,
      message: toStatus.message,
      details: {
        field: "to",
        original: toStatus.original,
      },
    }));
  }

  const context = await buildInvoiceTransitionContext({
    invoice,
    from: fromStatus.status,
    to: toStatus.status,
    repositories: input.repositories,
    contextOverrides: input.contextOverrides,
  });
  if (!context.ok) {
    return withFailureAudit(input, transitionApplyFailure("VALIDATION_FAILED", {
      lifecycle: "invoice",
      entityType: input.entityType,
      entityId: input.entityId,
      from: fromStatus.status,
      to: toStatus.status,
      message: context.message,
      details: context.details,
    }));
  }

  const authorizationResult = authorizeLifecycleTransition({
    lifecycle: "invoice",
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
      lifecycle: "invoice",
      entityType: input.entityType,
      entityId: input.entityId,
      from: fromStatus.status,
      to: toStatus.status,
      message: authorizationResult.message,
      authorizationResult,
    });
  }

  try {
    const updateResult = await input.repositories.updateInvoiceStatus(
      input.entityId,
      toStatus.status,
      getUpdateMetadata(input),
    );
    const persistedStatus = normalizeInvoiceStatusResult(
      getPersistedStatus(updateResult) ?? toStatus.status,
    );

    if (!persistedStatus.ok || persistedStatus.status !== toStatus.status) {
      return withFailureAudit(input, transitionApplyFailure("PERSISTENCE_FAILED", {
        lifecycle: "invoice",
        entityType: input.entityType,
        entityId: input.entityId,
        from: fromStatus.status,
        to: toStatus.status,
        message: persistedStatus.ok
          ? "Persisted invoice status did not match requested transition target."
          : persistedStatus.message,
        details: {
          persistedStatus: persistedStatus.ok ? persistedStatus.status : null,
        },
      }));
    }

    return withSuccessAudit(input, {
      ok: true,
      lifecycle: "invoice",
      entityType: input.entityType,
      entityId: input.entityId,
      from: fromStatus.status,
      to: toStatus.status,
      persistedStatus: persistedStatus.status,
      message: `Invoice transition ${fromStatus.status} -> ${toStatus.status} persisted.`,
      authorizationResult,
    });
  } catch (error) {
    return withFailureAudit(input, transitionApplyFailure("PERSISTENCE_FAILED", {
      lifecycle: "invoice",
      entityType: input.entityType,
      entityId: input.entityId,
      from: fromStatus.status,
      to: toStatus.status,
      message: "Failed to persist invoice status transition.",
      details: { error: error instanceof Error ? error.message : String(error) },
    }));
  }
}

function hasInvoiceRepository(
  repositories: ApplyLifecycleTransitionInput<"invoice">["repositories"],
): repositories is InvoiceTransitionRepository {
  return Boolean(
    repositories?.getInvoiceById &&
      repositories.updateInvoiceStatus &&
      repositories.getWorkOrderById,
  );
}

function getUpdateMetadata(
  input: ApplyLifecycleTransitionInput<"invoice">,
): TransitionUpdateMetadata {
  return {
    actorType: input.actorType,
    actorUserId: input.actorUserId,
    role: input.role,
    metadata: input.metadata,
  };
}

function getPersistedStatus(
  updateResult: Awaited<ReturnType<InvoiceTransitionRepository["updateInvoiceStatus"]>>,
): InvoiceLifecycleStatus | string | undefined {
  return updateResult && "status" in updateResult ? updateResult.status : undefined;
}

async function withFailureAudit(
  input: ApplyLifecycleTransitionInput<"invoice">,
  result: Extract<TransitionApplyResult<"invoice">, { ok: false }>,
): Promise<TransitionApplyResult<"invoice">> {
  const timestamp = new Date().toISOString();
  const logging = await logTransitionAttempt({
    repositories: input.repositories,
    record: buildTransitionAuditRecord({
      lifecycle: "invoice",
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
  input: ApplyLifecycleTransitionInput<"invoice">,
  result: Extract<TransitionApplyResult<"invoice">, { ok: true }>,
): Promise<TransitionApplyResult<"invoice">> {
  const timestamp = new Date().toISOString();
  const eventRecord = buildTransitionEventRecord({
    lifecycle: "invoice",
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
      lifecycle: "invoice",
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
  result: Extract<TransitionApplyResult<"invoice">, { ok: false }>,
): string | null {
  if (result.validationResult && !result.validationResult.ok) {
    return result.validationResult.failureCode;
  }

  const lifecycleFailureCode = result.authorizationResult?.details?.lifecycleFailureCode;
  return typeof lifecycleFailureCode === "string" ? lifecycleFailureCode : null;
}

function getStringMetadata(
  input: ApplyLifecycleTransitionInput<"invoice">,
  key: "correlationId" | "requestId",
): string | undefined {
  const value = input.metadata?.[key];
  return typeof value === "string" ? value : undefined;
}

function withSideEffectWarnings<TResult extends TransitionApplyResult<"invoice">>(
  result: TResult,
  warnings: readonly TransitionSideEffectWarning[],
): TResult {
  if (warnings.length === 0) {
    return result;
  }

  return { ...result, sideEffectWarnings: warnings };
}
