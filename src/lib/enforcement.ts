import {
  assertAuthorized,
  AuthorizationError,
  type AuthorizationAction,
  type AuthorizationRequest,
} from "@/lib/authorization";
import {
  createAuthorizationAuditLogger,
  defaultSecurityAuditLogger,
  type SecurityAuditLogger,
} from "@/lib/audit-log";
import type { AssignmentRelationshipContext } from "@/lib/access-policy";
import {
  exposeWorkOrderDataBundle,
  type VisibleWorkOrderDataBundle,
  type WorkOrderDataVisibilityBundle,
} from "@/lib/data-visibility";
import {
  validateMutationInput,
  validateStatusTransitionInput,
  type StatusTransitionInput,
} from "@/lib/input-validation";
import type { AccessActor } from "@/types/auth";
import type { EntityId } from "@/types/entity";

export interface EnforcedOperationOptions {
  auditLogger?: SecurityAuditLogger;
}

type ReadAuthorizationRequest = AuthorizationRequest & { action: "read" };
type MutationAuthorizationRequest = AuthorizationRequest & {
  action: Extract<AuthorizationAction, "create" | "edit" | "update">;
};
type TransitionAuthorizationRequest = AuthorizationRequest & {
  action: "transition";
  entity: StatusTransitionInput["entity"];
};

export async function enforceRead<TRecord, TVisible>(
  request: ReadAuthorizationRequest,
  read: () => TRecord | Promise<TRecord>,
  expose: (record: TRecord) => TVisible | null | undefined,
  options: EnforcedOperationOptions = {},
): Promise<TVisible> {
  assertAuthorized(withAuditLogger(request, options));

  const record = await read();
  const visible = expose(record);

  if (!visible) {
    throw new AuthorizationError({
      allowed: false,
      reason: "Read result is not visible to this actor and scope.",
    });
  }

  return visible;
}

export async function enforceMutation<TInput, TResult>(
  request: MutationAuthorizationRequest,
  input: TInput,
  mutate: (validatedInput: Record<string, unknown>) => TResult | Promise<TResult>,
  options: EnforcedOperationOptions = {},
): Promise<TResult> {
  const checkedInput = validateMutationInput({
    entity: request.entity,
    action: request.action,
    role: request.actor.role,
    input,
  });

  assertAuthorized(withAuditLogger(request, options));

  const result = await mutate(checkedInput);
  auditFinancialAction(request, options);
  return result;
}

export async function enforceStatusTransition<TResult>(
  request: TransitionAuthorizationRequest,
  input: unknown,
  transition: (validatedInput: StatusTransitionInput) => TResult | Promise<TResult>,
  options: EnforcedOperationOptions = {},
): Promise<TResult> {
  assertStatusTransitionEntity(request.entity);
  const checkedInput = validateStatusTransitionInput(request.entity, input);
  const authorizationRequest = {
    ...request,
    nextStatus: checkedInput.nextStatus,
    reason: checkedInput.reason ?? request.reason,
  } as TransitionAuthorizationRequest;

  assertAuthorized(withAuditLogger(authorizationRequest, options));

  const result = await transition(checkedInput);
  auditStatusTransition(authorizationRequest, options);
  return result;
}

function assertStatusTransitionEntity(
  entity: AuthorizationRequest["entity"],
): asserts entity is StatusTransitionInput["entity"] {
  if (
    entity !== "work_order" &&
    entity !== "assignment" &&
    entity !== "contractor_quote" &&
    entity !== "client_quote" &&
    entity !== "invoice"
  ) {
    throw new AuthorizationError({
      allowed: false,
      reason: `${entity} does not support status transitions.`,
    });
  }
}

export function enforceWorkOrderBundleRead(
  actor: AccessActor,
  bundle: WorkOrderDataVisibilityBundle,
  context: AssignmentRelationshipContext = {},
): VisibleWorkOrderDataBundle {
  const visible = exposeWorkOrderDataBundle(actor, bundle, context);

  if (!visible) {
    throw new AuthorizationError({
      allowed: false,
      reason: "Work order data bundle is not visible to this actor and scope.",
    });
  }

  return visible;
}

function withAuditLogger<TRequest extends AuthorizationRequest>(
  request: TRequest,
  options: EnforcedOperationOptions,
): TRequest {
  return {
    ...request,
    logger:
      request.logger ??
      createAuthorizationAuditLogger(
        options.auditLogger ?? defaultSecurityAuditLogger,
      ),
  };
}

function auditStatusTransition(
  request: TransitionAuthorizationRequest,
  options: EnforcedOperationOptions,
): void {
  const target = request.target as { id?: EntityId; organizationId?: EntityId };

  void (options.auditLogger ?? defaultSecurityAuditLogger)({
    eventType: "security_audit",
    kind: "status_transition",
    userId: request.actor.userId,
    role: request.actor.role,
    action: request.action,
    entity: request.entity,
    entityId: target.id,
    organizationId: target.organizationId,
    timestamp: new Date().toISOString(),
    currentStatus: "status" in request.target ? request.target.status : undefined,
    nextStatus: String(request.nextStatus),
    reason: request.reason,
    correlationId: request.correlationId,
  });
}

function auditFinancialAction(
  request: MutationAuthorizationRequest,
  options: EnforcedOperationOptions,
): void {
  if (
    request.entity !== "client_quote" &&
    request.entity !== "contractor_quote" &&
    request.entity !== "invoice" &&
    request.entity !== "payment_status" &&
    request.entity !== "billing_data"
  ) {
    return;
  }

  const target = request.target as { id?: EntityId; organizationId?: EntityId };

  void (options.auditLogger ?? defaultSecurityAuditLogger)({
    eventType: "security_audit",
    kind: "financial_action",
    userId: request.actor.userId,
    role: request.actor.role,
    action: request.action,
    entity: request.entity,
    entityId: target.id,
    organizationId: target.organizationId,
    timestamp: new Date().toISOString(),
    reason: request.reason,
    correlationId: request.correlationId,
  });
}
