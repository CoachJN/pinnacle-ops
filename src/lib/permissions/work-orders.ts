import "server-only";

import { workOrderPolicy } from "@/lib/access-policy";
import { AppError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/codes";
import { createAccessDeniedError } from "@/server/authorization";
import type { AccessActor } from "@/types/auth";
import type { EntityId, RecordStatus } from "@/types/entity";

export interface WorkOrderLocationSelectionTarget {
  organizationId: EntityId;
  clientOrganizationId: EntityId;
  locationId: EntityId;
}

export interface WorkOrderLocationSelectionContext {
  clientOrganization: {
    id: EntityId;
    status: "active" | "inactive";
    recordStatus: RecordStatus;
    isDeleted: boolean;
  };
  location: {
    id: EntityId;
    clientOrganizationId: EntityId;
    status: "active" | "inactive";
    recordStatus: RecordStatus;
    isDeleted: boolean;
  };
}

export function canCreateWorkOrderForLocationSelection(
  actor: AccessActor,
  target: WorkOrderLocationSelectionTarget,
): boolean {
  return workOrderPolicy.canCreate(actor, {
    organizationId: target.organizationId,
    clientOrganizationId: target.clientOrganizationId,
    locationId: target.locationId,
  });
}

export function assertCanCreateWorkOrderForLocationSelection(
  actor: AccessActor,
  target: WorkOrderLocationSelectionTarget,
): void {
  if (!canCreateWorkOrderForLocationSelection(actor, target)) {
    throw createAccessDeniedError(
      "You do not have access to create work orders for this client organization and location.",
    );
  }
}

export function canUpdateWorkOrderLocationSelection(
  actor: AccessActor,
  target: WorkOrderLocationSelectionTarget,
): boolean {
  return workOrderPolicy.canEdit(actor, {
    id: "work-order-location-update",
    organizationId: target.organizationId,
    clientOrganizationId: target.clientOrganizationId,
    locationId: target.locationId,
  });
}

export function assertCanUpdateWorkOrderLocationSelection(
  actor: AccessActor,
  target: WorkOrderLocationSelectionTarget,
): void {
  if (!canUpdateWorkOrderLocationSelection(actor, target)) {
    throw createAccessDeniedError(
      "You do not have access to move work orders to this client organization and location.",
    );
  }
}

export function assertValidWorkOrderLocationSelection(
  context: WorkOrderLocationSelectionContext,
): void {
  if (
    context.clientOrganization.isDeleted ||
    context.clientOrganization.recordStatus !== "active" ||
    context.clientOrganization.status !== "active"
  ) {
    throw createValidationError(
      "Inactive client organizations cannot be used for new work orders.",
    );
  }

  if (
    context.location.isDeleted ||
    context.location.recordStatus !== "active" ||
    context.location.status !== "active"
  ) {
    throw createValidationError(
      "Inactive locations cannot be used for new work orders.",
    );
  }

  if (
    context.location.clientOrganizationId !== context.clientOrganization.id
  ) {
    throw createValidationError(
      "Selected location does not belong to the specified client organization.",
    );
  }
}

function createValidationError(message: string): AppError {
  return new AppError({
    code: ERROR_CODES.ValidationFailed,
    message,
    safeMessage: message,
  });
}
