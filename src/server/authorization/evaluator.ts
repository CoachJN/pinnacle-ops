import "server-only";

import {
  AuthorizationError,
  assertAuthorized,
  authorize,
  getAuthorizationDecision,
  type AuthorizationDecision,
  type AuthorizationRequest,
} from "@/lib/authorization";

export type ServerAuthorizationRequest = AuthorizationRequest;
export type ServerAuthorizationDecision = AuthorizationDecision;

export function canUserPerformAction(
  request: ServerAuthorizationRequest,
): boolean {
  return getAuthorizationDecision(request).allowed;
}

export function requirePermission(request: ServerAuthorizationRequest): void {
  assertPermission(request);
}

export function assertPermission(request: ServerAuthorizationRequest): void {
  assertAuthorized(request);
}

export function evaluatePermission(
  request: ServerAuthorizationRequest,
): ServerAuthorizationDecision {
  return authorize(request);
}

export function createAccessDeniedError(
  decisionOrReason?: ServerAuthorizationDecision | string,
): AuthorizationError {
  if (typeof decisionOrReason === "string") {
    return new AuthorizationError({
      allowed: false,
      reason: decisionOrReason,
    });
  }

  return new AuthorizationError(
    decisionOrReason ?? {
      allowed: false,
      reason: "Action is not authorized for this actor, entity, and scope.",
    },
  );
}

export { AuthorizationError };
