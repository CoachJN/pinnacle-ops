import type { TransitionAuditRecord } from "./types.ts";

export type BuildTransitionAuditRecordInput = TransitionAuditRecord;

export function buildTransitionAuditRecord(
  input: BuildTransitionAuditRecordInput,
): TransitionAuditRecord {
  return {
    auditId: input.auditId,
    lifecycle: input.lifecycle,
    entityType: input.entityType,
    entityId: input.entityId,
    actorType: input.actorType,
    role: input.role ?? null,
    actorUserId: input.actorUserId ?? null,
    attemptedFromStatus: input.attemptedFromStatus,
    attemptedToStatus: input.attemptedToStatus,
    finalOutcome: input.finalOutcome,
    failureCode: input.failureCode ?? null,
    message: input.message,
    authorizationFailureCode: input.authorizationFailureCode ?? null,
    validationFailureCode: input.validationFailureCode ?? null,
    timestamp: input.timestamp,
    metadata: input.metadata,
    correlationId: input.correlationId,
    requestId: input.requestId,
  };
}
