import "server-only";

import { locationPolicy } from "@/lib/access-policy";
import { AppError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/codes";
import { createAccessDeniedError } from "@/server/authorization";
import type { AccessActor } from "@/types/auth";
import type { EntityId } from "@/types/entity";
import type { Location } from "@/types/location";
import {
  assertClientOrganizationScopeAccess,
  getScopedClientOrganizationId,
} from "./client-organizations";

export interface LocationCreatePermissionTarget {
  organizationId: EntityId;
  clientOrganizationId: EntityId;
}

export interface LocationPermissionTarget {
  id: EntityId;
  organizationId: EntityId;
  clientOrganizationId: EntityId;
}

export function canCreateLocation(
  actor: AccessActor,
  target: LocationCreatePermissionTarget,
): boolean {
  return locationPolicy.canCreate(actor, target);
}

export function canReadLocation(
  actor: AccessActor,
  target: LocationPermissionTarget,
): boolean {
  return locationPolicy.canRead(actor, target);
}

export function canUpdateLocation(
  actor: AccessActor,
  target: LocationPermissionTarget,
): boolean {
  return locationPolicy.canUpdate(actor, target);
}

export function canArchiveLocation(
  actor: AccessActor,
  target: LocationPermissionTarget,
): boolean {
  return locationPolicy.canTransition(actor, target);
}

export function assertCanCreateLocation(
  actor: AccessActor,
  target: LocationCreatePermissionTarget,
): void {
  if (!canCreateLocation(actor, target)) {
    throw createAccessDeniedError("You do not have access to create locations.");
  }
}

export function assertCanReadLocation(
  actor: AccessActor,
  target: LocationPermissionTarget,
): void {
  if (!canReadLocation(actor, target)) {
    throw createAccessDeniedError("You do not have access to this location.");
  }
}

export function assertCanUpdateLocation(
  actor: AccessActor,
  target: LocationPermissionTarget,
): void {
  if (!canUpdateLocation(actor, target)) {
    throw createAccessDeniedError("You do not have access to update this location.");
  }
}

export function assertCanArchiveLocation(
  actor: AccessActor,
  target: LocationPermissionTarget,
): void {
  if (!canArchiveLocation(actor, target)) {
    throw createAccessDeniedError(
      "You do not have access to archive this location.",
    );
  }
}

export function getScopedLocationClientOrganizationId(
  actor: AccessActor,
  requestedClientOrganizationId: EntityId,
): EntityId {
  const scopedClientOrganizationId = getScopedClientOrganizationId(
    actor,
    requestedClientOrganizationId,
  );

  if (!scopedClientOrganizationId) {
    throw createValidationError("Client organization is required.");
  }

  assertClientOrganizationScopeAccess(actor, scopedClientOrganizationId);

  return scopedClientOrganizationId;
}

export function assertLocationOwnershipUnchanged(
  existing: Pick<Location, "clientOrganizationId">,
  nextClientOrganizationId: EntityId | undefined,
): void {
  if (
    nextClientOrganizationId !== undefined &&
    nextClientOrganizationId !== existing.clientOrganizationId
  ) {
    throw createValidationError(
      "Locations cannot be reassigned across client organizations.",
    );
  }
}

export function toLocationPermissionTarget(
  location: Pick<Location, "id" | "organizationId" | "clientOrganizationId">,
): LocationPermissionTarget {
  return {
    id: location.id,
    organizationId: location.organizationId,
    clientOrganizationId: location.clientOrganizationId,
  };
}

function createValidationError(message: string): AppError {
  return new AppError({
    code: ERROR_CODES.ValidationFailed,
    message,
    safeMessage: message,
  });
}
