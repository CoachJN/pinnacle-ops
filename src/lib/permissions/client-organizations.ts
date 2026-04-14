import "server-only";

import { clientOrganizationPolicy } from "@/lib/access-policy";
import { AppError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/codes";
import { createAccessDeniedError } from "@/server/authorization";
import type { AccessActor } from "@/types/auth";
import type { ClientOrganization } from "@/types/client-organization";
import type { EntityId } from "@/types/entity";

export interface ClientOrganizationPermissionTarget {
  id: EntityId;
  organizationId: EntityId;
}

export function canReadClientOrganization(
  actor: AccessActor,
  target: ClientOrganizationPermissionTarget,
): boolean {
  return clientOrganizationPolicy.canRead(actor, target);
}

export function canManageClientOrganization(
  actor: AccessActor,
  target: ClientOrganizationPermissionTarget,
): boolean {
  return clientOrganizationPolicy.canUpdate(actor, target);
}

export function assertCanReadClientOrganization(
  actor: AccessActor,
  target: ClientOrganizationPermissionTarget,
): void {
  if (!canReadClientOrganization(actor, target)) {
    throw createAccessDeniedError(
      "You do not have access to this client organization.",
    );
  }
}

export function assertCanManageClientOrganization(
  actor: AccessActor,
  target: ClientOrganizationPermissionTarget,
): void {
  if (!canManageClientOrganization(actor, target)) {
    throw createAccessDeniedError(
      "You do not have permission to manage this client organization.",
    );
  }
}

export function canAccessClientOrganizationScope(
  actor: AccessActor,
  clientOrganizationId: EntityId,
): boolean {
  if (actor.actorType === "contractor") {
    return false;
  }

  if (actor.actorType === "client") {
    return actor.scope.clientOrganizationId === clientOrganizationId;
  }

  return true;
}

export function assertClientOrganizationScopeAccess(
  actor: AccessActor,
  clientOrganizationId: EntityId,
): void {
  if (canAccessClientOrganizationScope(actor, clientOrganizationId)) {
    return;
  }

  if (actor.actorType === "client") {
    throw createValidationError(
      "Client users can only act within their own client organization.",
    );
  }

  throw createAccessDeniedError(
    "You do not have access to this client organization.",
  );
}

export function getScopedClientOrganizationId(
  actor: AccessActor,
  requestedClientOrganizationId?: EntityId,
): EntityId | undefined {
  if (actor.actorType === "client") {
    if (
      requestedClientOrganizationId &&
      requestedClientOrganizationId !== actor.scope.clientOrganizationId
    ) {
      throw createValidationError(
        "Client users can only act within their own client organization.",
      );
    }

    return actor.scope.clientOrganizationId;
  }

  return requestedClientOrganizationId;
}

export function toClientOrganizationPermissionTarget(
  organization: Pick<ClientOrganization, "id" | "organizationId">,
): ClientOrganizationPermissionTarget {
  return {
    id: organization.id,
    organizationId: organization.organizationId,
  };
}

function createValidationError(message: string): AppError {
  return new AppError({
    code: ERROR_CODES.ValidationFailed,
    message,
    safeMessage: message,
  });
}
