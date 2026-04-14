import {
  type InvoiceLifecycleStatus,
  type QuoteLifecycleStatus,
  type WorkOrderLifecycleStatus,
} from "../lifecycle/index.ts";
import {
  validateLifecycleTransition,
  type TransitionLifecycle,
  type TransitionStatusByLifecycle,
} from "../transition-engine/index.ts";
import {
  normalizeActorType,
  normalizePlatformRole,
  normalizeTransitionLifecycle,
} from "./adapters.ts";
import { isRoleAllowedForInvoiceTransition } from "./invoice-rules.ts";
import {
  TRANSITION_ACTOR_TYPES,
  type PlatformRole,
  type TransitionActorType,
} from "./role-types.ts";
import { isRoleAllowedForQuoteTransition } from "./quote-rules.ts";
import type {
  LifecycleTransitionAuthorizationInput,
  RoleTransitionAuthorizationDecision,
  TransitionAuthorizationResult,
} from "./types.ts";
import { isRoleAllowedForWorkOrderTransition } from "./work-order-rules.ts";

export function authorizeLifecycleTransition(
  input: LifecycleTransitionAuthorizationInput,
): TransitionAuthorizationResult {
  const lifecycle = normalizeTransitionLifecycle(input.lifecycle);
  if (!lifecycle.ok) {
    return {
      ok: false,
      lifecycle: input.lifecycle,
      from: input.from,
      to: input.to,
      actorType: input.actorType,
      role: input.role,
      failureCode: lifecycle.failureCode,
      message: lifecycle.message,
      details: { originalLifecycle: input.lifecycle },
    };
  }

  const actorType = normalizeActorType(input.actorType);
  if (!actorType.ok) {
    return {
      ok: false,
      lifecycle: lifecycle.value,
      from: input.from,
      to: input.to,
      actorType: input.actorType,
      role: input.role,
      failureCode: actorType.failureCode,
      message: actorType.message,
    };
  }

  const role =
    actorType.value === TRANSITION_ACTOR_TYPES.User
      ? normalizePlatformRole(input.role)
      : undefined;

  if (role && !role.ok) {
    return {
      ok: false,
      lifecycle: lifecycle.value,
      from: input.from,
      to: input.to,
      actorType: actorType.value,
      role: input.role,
      failureCode: role.failureCode,
      message: role.message,
    };
  }

  const lifecycleValidation = validateLifecycleTransition({
    lifecycle: lifecycle.value,
    from: input.from,
    to: input.to,
    context: input.context,
  });

  if (!lifecycleValidation.ok) {
    return {
      ok: false,
      lifecycle: lifecycle.value,
      from: input.from,
      to: input.to,
      normalizedFrom: "normalizedFrom" in lifecycleValidation
        ? lifecycleValidation.normalizedFrom
        : undefined,
      normalizedTo: "normalizedTo" in lifecycleValidation
        ? lifecycleValidation.normalizedTo
        : undefined,
      actorType: actorType.value,
      role: role?.value,
      failureCode: "LIFECYCLE_VALIDATION_FAILED",
      message: lifecycleValidation.message,
      details: {
        lifecycleFailureCode: lifecycleValidation.failureCode,
        lifecycleDetails: lifecycleValidation.details,
      },
    };
  }

  const normalizedFrom = lifecycleValidation.normalizedFrom as
    | TransitionStatusByLifecycle[typeof lifecycle.value]
    | undefined;
  const normalizedTo = lifecycleValidation.normalizedTo as
    | TransitionStatusByLifecycle[typeof lifecycle.value]
    | undefined;

  if (!normalizedFrom || !normalizedTo) {
    return {
      ok: false,
      lifecycle: lifecycle.value,
      from: input.from,
      to: input.to,
      actorType: actorType.value,
      role: role?.value,
      failureCode: "STATUS_MODEL_MISMATCH",
      message: "Lifecycle validation did not return normalized statuses.",
    };
  }

  const roleDecision = getRoleDecision(
    lifecycle.value,
    normalizedFrom,
    normalizedTo,
    actorType.value,
    role?.value,
  );

  if (!roleDecision.allowed) {
    return {
      ok: false,
      lifecycle: lifecycle.value,
      from: input.from,
      to: input.to,
      normalizedFrom,
      normalizedTo,
      actorType: actorType.value,
      role: role?.value,
      failureCode: roleDecision.failureCode ?? "ROLE_NOT_PERMITTED",
      message: roleDecision.message,
      details: roleDecision.details,
    };
  }

  return {
    ok: true,
    lifecycle: lifecycle.value,
    from: input.from,
    to: input.to,
    normalizedFrom,
    normalizedTo,
    actorType: actorType.value,
    role: role?.value,
    message: roleDecision.message,
    details: roleDecision.details,
  };
}

function getRoleDecision(
  lifecycle: TransitionLifecycle,
  from: WorkOrderLifecycleStatus | QuoteLifecycleStatus | InvoiceLifecycleStatus,
  to: WorkOrderLifecycleStatus | QuoteLifecycleStatus | InvoiceLifecycleStatus,
  actorType: TransitionActorType,
  role?: PlatformRole,
): RoleTransitionAuthorizationDecision {
  switch (lifecycle) {
    case "work-order":
      return isRoleAllowedForWorkOrderTransition({
        from: from as WorkOrderLifecycleStatus,
        to: to as WorkOrderLifecycleStatus,
        actorType,
        role,
      });
    case "quote":
      return isRoleAllowedForQuoteTransition({
        from: from as QuoteLifecycleStatus,
        to: to as QuoteLifecycleStatus,
        actorType,
        role,
      });
    case "invoice":
      return isRoleAllowedForInvoiceTransition({
        from: from as InvoiceLifecycleStatus,
        to: to as InvoiceLifecycleStatus,
        actorType,
        role,
      });
  }
}
