import "server-only";

import {
  WORK_ORDER_TRANSITIONS,
  canWorkOrderTransition,
} from "@/server/services/status-rules";
import {
  WORK_ORDER_STATUS_TRANSITION_MAP as PHASE_THREE_WORK_ORDER_TRANSITIONS,
  isWorkOrderStatusTransitionAllowed,
  type WorkOrderStatus as PhaseThreeWorkOrderStatus,
} from "@/modules/work-orders";
import type { AccessActor } from "@/types/auth";
import type { EntityId } from "@/types/entity";
import { USER_ROLES, type InternalUserRole } from "@/types/permissions";
import type { WorkOrderStatus as LegacyWorkOrderStatus } from "@/types/work-order";

export type WorkOrderStatus = LegacyWorkOrderStatus | PhaseThreeWorkOrderStatus;

export const WORK_ORDER_INTERNAL_ROLES = [
  USER_ROLES.Coordinator,
  USER_ROLES.Manager,
  USER_ROLES.FinanceAdmin,
  USER_ROLES.Owner,
] as const satisfies readonly InternalUserRole[];

const WORK_ORDER_CREATE_ROLES = [
  USER_ROLES.Coordinator,
  USER_ROLES.Manager,
  USER_ROLES.Owner,
] as const satisfies readonly AccessActor["role"][];

const WORK_ORDER_BASIC_EDIT_ROLES = [
  USER_ROLES.Coordinator,
  USER_ROLES.Manager,
  USER_ROLES.Owner,
] as const satisfies readonly AccessActor["role"][];

const WORK_ORDER_NOTE_ROLES = [
  USER_ROLES.Coordinator,
  USER_ROLES.Manager,
  USER_ROLES.FinanceAdmin,
  USER_ROLES.Owner,
] as const satisfies readonly AccessActor["role"][];

const WORK_ORDER_ATTACHMENT_ROLES = [
  USER_ROLES.Coordinator,
  USER_ROLES.Manager,
  USER_ROLES.Owner,
] as const satisfies readonly AccessActor["role"][];

const WORK_ORDER_COORDINATOR_STATUS_TARGETS: readonly WorkOrderStatus[] = [
  "new",
  "draft",
  "submitted",
  "in_review",
  "quote_requested",
  "quote_received",
  "dispatched",
  "assigned",
  "in_progress",
  "waiting_on_contractor",
  "waiting_on_customer",
  "quoted",
  "approved",
  "scheduled",
  "completed",
  "cancelled",
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

const WORK_ORDER_MANAGER_STATUS_TARGETS: readonly WorkOrderStatus[] = [
  ...WORK_ORDER_COORDINATOR_STATUS_TARGETS,
  "pending_client_approval",
  "approved_to_proceed",
  "READY_FOR_INVOICING",
] as const;

const WORK_ORDER_FINANCE_STATUS_TARGETS: readonly WorkOrderStatus[] = [
  "READY_FOR_INVOICING",
  "invoiced",
  "paid",
  "closed",
  "CLOSED",
] as const;

const TERMINAL_WORK_ORDER_STATUSES: readonly WorkOrderStatus[] = [
  "closed",
  "cancelled",
  "CLOSED",
  "CANCELLED",
] as const;

const FINANCE_EDITABLE_WORK_ORDER_STATUSES: readonly WorkOrderStatus[] = [
  "completed",
  "invoiced",
  "paid",
  "closed",
  "COMPLETED",
  "CLOSED",
] as const;

export interface WorkOrderPermissionTarget {
  organizationId: EntityId;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  id?: EntityId;
  status?: WorkOrderStatus;
  requestedByUserId?: EntityId | null;
  assignedCoordinatorUserId?: EntityId | null;
  assignedManagerUserId?: EntityId | null;
  assignedContractorOrganizationId?: EntityId | null;
}

export interface WorkOrderPermissionOptions {
  editScope?: "basic" | "finance_admin";
}

export type WorkOrderListPermissionScope =
  | {
      organizationId: EntityId;
      scope: "organization";
    }
  | {
      organizationId: EntityId;
      scope: "clientOrganization";
      clientOrganizationId: EntityId;
    }
  | {
      organizationId: EntityId;
      scope: "locations";
      clientOrganizationId: EntityId;
      locationIds: EntityId[];
    }
  | {
      organizationId: EntityId;
      scope: "contractorOrganization";
      contractorOrganizationId: EntityId;
    };

export function getWorkOrderListPermissionScope(
  actor: AccessActor,
): WorkOrderListPermissionScope {
  if (actor.actorType === "internal") {
    return {
      organizationId: actor.scope.organizationId,
      scope: "organization",
    };
  }

  if (actor.actorType === "client") {
    if (actor.scope.locationAccess.kind === "all_client_locations") {
      return {
        organizationId: actor.scope.organizationId,
        scope: "clientOrganization",
        clientOrganizationId: actor.scope.clientOrganizationId,
      };
    }

    return {
      organizationId: actor.scope.organizationId,
      scope: "locations",
      clientOrganizationId: actor.scope.clientOrganizationId,
      locationIds: [...actor.scope.locationAccess.locationIds],
    };
  }

  return {
    organizationId: actor.scope.organizationId,
    scope: "contractorOrganization",
    contractorOrganizationId: actor.scope.contractorOrganizationId,
  };
}

export function canCreateWorkOrder(
  actor: AccessActor,
  target: WorkOrderPermissionTarget,
): boolean {
  if (!isActorInOrganizationScope(actor, target.organizationId)) {
    return false;
  }

  if (hasRole(actor, WORK_ORDER_CREATE_ROLES)) {
    return true;
  }

  if (actor.actorType !== "client") {
    return false;
  }

  return (
    actor.scope.clientOrganizationId === target.clientOrganizationId &&
    isLocationInClientScope(actor, target.locationId)
  );
}

export function canViewWorkOrder(
  actor: AccessActor,
  target: WorkOrderPermissionTarget,
): boolean {
  return isWorkOrderInActorScope(actor, target);
}

export function canEditWorkOrder(
  actor: AccessActor,
  target: WorkOrderPermissionTarget,
  options: WorkOrderPermissionOptions = {},
): boolean {
  if (!canViewWorkOrder(actor, target)) {
    return false;
  }

  if (actor.actorType !== "internal") {
    return false;
  }

  if (actor.role === USER_ROLES.Owner) {
    return true;
  }

  if (options.editScope === "finance_admin") {
    return (
      actor.role === USER_ROLES.FinanceAdmin &&
      isStatusInSet(target.status, FINANCE_EDITABLE_WORK_ORDER_STATUSES)
    );
  }

  if (isStatusInSet(target.status, TERMINAL_WORK_ORDER_STATUSES)) {
    return false;
  }

  return hasRole(actor, WORK_ORDER_BASIC_EDIT_ROLES);
}

export function canUpdateWorkOrderStatus(
  actor: AccessActor,
  target: WorkOrderPermissionTarget & { status: WorkOrderStatus },
  nextStatus: WorkOrderStatus,
): boolean {
  if (!canViewWorkOrder(actor, target)) {
    return false;
  }

  if (!canTransitionWorkOrderStatus(target.status, nextStatus)) {
    return false;
  }

  if (actor.actorType !== "internal") {
    return false;
  }

  if (actor.role === USER_ROLES.Owner) {
    return true;
  }

  if (actor.role === USER_ROLES.Coordinator) {
    return WORK_ORDER_COORDINATOR_STATUS_TARGETS.includes(nextStatus);
  }

  if (actor.role === USER_ROLES.Manager) {
    return WORK_ORDER_MANAGER_STATUS_TARGETS.includes(nextStatus);
  }

  if (actor.role === USER_ROLES.FinanceAdmin) {
    return WORK_ORDER_FINANCE_STATUS_TARGETS.includes(nextStatus);
  }

  return false;
}

export function canAddWorkOrderNote(
  actor: AccessActor,
  target: WorkOrderPermissionTarget,
): boolean {
  return canViewWorkOrder(actor, target) && hasRole(actor, WORK_ORDER_NOTE_ROLES);
}

export function canAddWorkOrderAttachment(
  actor: AccessActor,
  target: WorkOrderPermissionTarget,
): boolean {
  return (
    canViewWorkOrder(actor, target) &&
    hasRole(actor, WORK_ORDER_ATTACHMENT_ROLES)
  );
}

export function canListWorkOrders(
  actor: AccessActor,
  scope: WorkOrderListPermissionScope,
): boolean {
  if (!isActorInOrganizationScope(actor, scope.organizationId)) {
    return false;
  }

  if (actor.actorType === "internal") {
    return true;
  }

  if (actor.actorType === "client") {
    if (scope.scope === "organization" || scope.scope === "contractorOrganization") {
      return false;
    }

    if (scope.clientOrganizationId !== actor.scope.clientOrganizationId) {
      return false;
    }

    if (scope.scope === "clientOrganization") {
      return true;
    }

    return scope.locationIds.every((locationId) =>
      isLocationInClientScope(actor, locationId),
    );
  }

  if (scope.scope !== "contractorOrganization") {
    return false;
  }

  return scope.contractorOrganizationId === actor.scope.contractorOrganizationId;
}

export function getAllowedWorkOrderStatusTransitions(
  actor: AccessActor,
  target: WorkOrderPermissionTarget & { status: WorkOrderStatus },
): WorkOrderStatus[] {
  return getWorkOrderTransitions(target.status).filter((nextStatus) =>
    canUpdateWorkOrderStatus(actor, target, nextStatus),
  );
}

export function hasClientOrganizationScope(
  actor: AccessActor,
  clientOrganizationId: EntityId,
): boolean {
  if (actor.actorType === "internal") {
    return true;
  }

  if (actor.actorType === "client") {
    return actor.scope.clientOrganizationId === clientOrganizationId;
  }

  return false;
}

export function hasLocationScope(
  actor: AccessActor,
  locationId: EntityId,
): boolean {
  if (actor.actorType !== "client") {
    return actor.actorType === "internal";
  }

  return isLocationInClientScope(actor, locationId);
}

export function isWorkOrderInternalRole(
  role: AccessActor["role"],
): role is InternalUserRole {
  return WORK_ORDER_INTERNAL_ROLES.includes(role as InternalUserRole);
}

export function isWorkOrderInActorScope(
  actor: AccessActor,
  target: WorkOrderPermissionTarget,
): boolean {
  if (!isActorInOrganizationScope(actor, target.organizationId)) {
    return false;
  }

  if (actor.actorType === "internal") {
    return true;
  }

  if (actor.actorType === "client") {
    return (
      hasClientOrganizationScope(actor, target.clientOrganizationId) &&
      hasLocationScope(actor, target.locationId)
    );
  }

  if (
    target.assignedContractorOrganizationId !== actor.scope.contractorOrganizationId
  ) {
    return false;
  }

  if (!target.id) {
    return true;
  }

  return hasAssignedWorkOrderScope(actor, target.id);
}

export function hasAssignedWorkOrderScope(
  actor: AccessActor,
  workOrderId: EntityId,
): boolean {
  if (actor.actorType !== "contractor") {
    return actor.actorType === "internal";
  }

  return (
    actor.scope.assignedWorkOrderIds === undefined ||
    actor.scope.assignedWorkOrderIds.includes(workOrderId)
  );
}

function isActorInOrganizationScope(
  actor: AccessActor,
  organizationId: EntityId,
): boolean {
  return actor.scope.organizationId === organizationId;
}

function isLocationInClientScope(
  actor: Extract<AccessActor, { actorType: "client" }>,
  locationId: EntityId,
): boolean {
  if (actor.scope.locationAccess.kind === "all_client_locations") {
    return true;
  }

  return actor.scope.locationAccess.locationIds.includes(locationId);
}

function isStatusInSet(
  status: WorkOrderStatus | undefined,
  statuses: readonly WorkOrderStatus[],
): boolean {
  return status !== undefined && statuses.includes(status);
}

function canTransitionWorkOrderStatus(
  from: WorkOrderStatus,
  to: WorkOrderStatus,
): boolean {
  if (isLegacyWorkOrderStatus(from) && isLegacyWorkOrderStatus(to)) {
    return canWorkOrderTransition(from, to);
  }

  if (isPhaseThreeWorkOrderStatus(from) && isPhaseThreeWorkOrderStatus(to)) {
    return isWorkOrderStatusTransitionAllowed(from, to);
  }

  return false;
}

function getWorkOrderTransitions(status: WorkOrderStatus): WorkOrderStatus[] {
  if (isLegacyWorkOrderStatus(status)) {
    return [...WORK_ORDER_TRANSITIONS[status]];
  }

  return [...PHASE_THREE_WORK_ORDER_TRANSITIONS[status]];
}

function isLegacyWorkOrderStatus(
  status: WorkOrderStatus,
): status is LegacyWorkOrderStatus {
  return status in WORK_ORDER_TRANSITIONS;
}

function isPhaseThreeWorkOrderStatus(
  status: WorkOrderStatus,
): status is PhaseThreeWorkOrderStatus {
  return status in PHASE_THREE_WORK_ORDER_TRANSITIONS;
}

function hasRole<const TRole extends AccessActor["role"]>(
  actor: AccessActor,
  roles: readonly TRole[],
): boolean {
  return roles.includes(actor.role as TRole);
}
