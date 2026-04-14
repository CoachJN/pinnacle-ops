import "server-only";

import { z } from "zod";

import {
  acceptAssignmentSchema,
  completeAssignmentSchema,
  createAssignmentSchema,
  declineAssignmentSchema,
  reassignAssignmentSchema,
  type Assignment,
  type AssignmentStatus,
  type CreateAssignmentDto,
  type DeclineAssignmentDto,
  type ReassignAssignmentDto,
  type WorkOrder,
  type WorkOrderActionAvailability,
  type WorkOrderStatus,
  workOrderStatusTransitionWithAssignmentSchema,
} from "../../../modules/work-orders/index.ts";
import type { AccessActor } from "../../../types/auth.ts";
import type { EntityId } from "../../../types/entity.ts";
import { USER_ROLES, type InternalUserRole } from "../../../types/permissions.ts";
import type {
  ActivityLogService,
  ServiceAuditContext,
  ServiceResult,
} from "../../../server/services/index.ts";
import {
  conflictError,
  notFoundError,
  validationError,
} from "../../../server/services/errors.ts";
import { serviceFail, serviceOk } from "../../../server/services/types.ts";
import type {
  Assignment as RepositoryAssignment,
  AssignmentRepository,
  UserProfileRepository,
} from "../../../server/repositories/index.ts";
import type { WorkOrderRepository as PhaseThreeWorkOrderRepository } from "@/lib/repositories/work-order.repository";

const ASSIGNMENT_OPERATIONS_ROLES = new Set<InternalUserRole>([
  USER_ROLES.Coordinator,
  USER_ROLES.Manager,
  USER_ROLES.Owner,
]);

const ASSIGNMENT_COMPLETION_OVERRIDE_ROLES = new Set<InternalUserRole>([
  USER_ROLES.Coordinator,
  USER_ROLES.Manager,
  USER_ROLES.Owner,
]);

export interface AssignmentWorkflowDependencies {
  assignments: AssignmentRepository;
  workOrders: PhaseThreeWorkOrderRepository;
  userProfiles: UserProfileRepository;
  activityLogs: ActivityLogService;
}

export interface CreateAssignmentServiceInput extends ServiceAuditContext {
  workOrderId: EntityId;
  payload: unknown;
}

export interface ReassignAssignmentServiceInput extends ServiceAuditContext {
  workOrderId: EntityId;
  payload: unknown;
}

export interface UpdateAssignmentStateServiceInput extends ServiceAuditContext {
  workOrderId: EntityId;
  payload: unknown;
}

export interface TransitionWorkOrderWithAssignmentInput extends ServiceAuditContext {
  workOrderId: EntityId;
  payload: unknown;
}

export interface WorkOrderActionAvailabilityContext {
  actor: AccessActor;
  workOrder: WorkOrder;
  activeAssignment: Assignment | null;
}

export function getAllowedWorkOrderActions(
  input: WorkOrderActionAvailabilityContext,
): WorkOrderActionAvailability & {
  availableStatusTransitions: readonly WorkOrderStatus[];
} {
  const canAssign = canAssignWorkOrder(input.actor);
  const canReassign = canAssign && input.activeAssignment !== null;
  const canAcceptAssignment =
    input.activeAssignment?.status === "assigned" &&
    canActorRespondToAssignment(input.actor, input.activeAssignment);
  const canDeclineAssignment =
    input.activeAssignment?.status === "assigned" &&
    canActorRespondToAssignment(input.actor, input.activeAssignment);
  const canCompleteAssignment =
    input.activeAssignment?.status === "accepted" &&
    canActorCompleteAssignment(input.actor, input.activeAssignment);

  const availableStatusTransitions = getAllowedStatusTransitions(input);

  return {
    canUpdateStatus: availableStatusTransitions.length > 0,
    canAddNote: input.workOrder.status !== "CLOSED",
    canAddAttachment: input.workOrder.status !== "CLOSED",
    canAssign,
    canReassign,
    canAcceptAssignment,
    canDeclineAssignment,
    canCompleteAssignment,
    availableStatusTransitions,
  };
}

export async function createAssignment(
  dependencies: AssignmentWorkflowDependencies,
  input: CreateAssignmentServiceInput,
): Promise<ServiceResult<RepositoryAssignment>> {
  const parsed = parseSchema(createAssignmentSchema, input.payload);
  if (!parsed.ok) {
    return parsed;
  }

  return createAssignmentRecord(dependencies, input, parsed.value, null);
}

export async function reassignAssignment(
  dependencies: AssignmentWorkflowDependencies,
  input: ReassignAssignmentServiceInput,
): Promise<ServiceResult<RepositoryAssignment>> {
  const parsed = parseSchema(reassignAssignmentSchema, input.payload);
  if (!parsed.ok) {
    return parsed;
  }

  const currentAssignment = await dependencies.assignments.getById(
    parsed.value.currentAssignmentId,
  );
  if (
    !currentAssignment ||
    currentAssignment.isDeleted ||
    currentAssignment.workOrderId !== input.workOrderId
  ) {
    return serviceFail(notFoundError("Active assignment could not be found."));
  }

  if (!isActiveAssignmentStatus(currentAssignment.status)) {
    return serviceFail(
      conflictError("Only active assignments can be reassigned."),
    );
  }

  await dependencies.assignments.save({
    ...currentAssignment,
    status: "cancelled",
    updatedAt: input.now ?? new Date().toISOString(),
    updatedByUserId: input.actor.userId,
  });

  await dependencies.activityLogs.record({
    ...input,
    workOrderId: input.workOrderId,
    action: "assignment.reassigned",
    eventType: "assignment_reassigned",
    message: "Cancelled prior active assignment during reassignment.",
    entityType: "assignment",
    entityId: currentAssignment.id,
    entityLabel: currentAssignment.contractorSnapshot?.name ?? currentAssignment.assigneeUserId,
    visibility: "internal",
    changes: [{ field: "status", from: currentAssignment.status, to: "cancelled" }],
  });

  return createAssignmentRecord(dependencies, input, parsed.value, currentAssignment.id);
}

export async function acceptAssignment(
  dependencies: AssignmentWorkflowDependencies,
  input: UpdateAssignmentStateServiceInput,
): Promise<ServiceResult<RepositoryAssignment>> {
  const parsed = parseSchema(acceptAssignmentSchema, input.payload);
  if (!parsed.ok) {
    return parsed;
  }

  return updateAssignmentStatus(dependencies, input, parsed.value.assignmentId, "accepted");
}

export async function declineAssignment(
  dependencies: AssignmentWorkflowDependencies,
  input: UpdateAssignmentStateServiceInput,
): Promise<ServiceResult<RepositoryAssignment>> {
  const parsed = parseSchema(declineAssignmentSchema, input.payload);
  if (!parsed.ok) {
    return parsed;
  }

  return updateAssignmentStatus(
    dependencies,
    input,
    parsed.value.assignmentId,
    "declined",
    parsed.value,
  );
}

export async function completeAssignment(
  dependencies: AssignmentWorkflowDependencies,
  input: UpdateAssignmentStateServiceInput,
): Promise<ServiceResult<RepositoryAssignment>> {
  const parsed = parseSchema(completeAssignmentSchema, input.payload);
  if (!parsed.ok) {
    return parsed;
  }

  return updateAssignmentStatus(
    dependencies,
    input,
    parsed.value.assignmentId,
    "completed",
    parsed.value,
  );
}

export async function getActiveAssignmentForWorkOrder(
  dependencies: Pick<AssignmentWorkflowDependencies, "assignments">,
  workOrderId: EntityId,
): Promise<ServiceResult<RepositoryAssignment | null>> {
  return serviceOk(await dependencies.assignments.getActiveByWorkOrderId(workOrderId));
}

export async function getAssignmentsForWorkOrder(
  dependencies: Pick<AssignmentWorkflowDependencies, "assignments">,
  workOrderId: EntityId,
): Promise<ServiceResult<RepositoryAssignment[]>> {
  const result = await dependencies.assignments.listByWorkOrderId(workOrderId);
  return serviceOk(result.items);
}

export async function transitionWorkOrderStatusWithAssignmentChecks(
  dependencies: Pick<
    AssignmentWorkflowDependencies,
    "activityLogs" | "assignments" | "workOrders"
  >,
  actor: AccessActor,
  input: TransitionWorkOrderWithAssignmentInput,
): Promise<ServiceResult<WorkOrder>> {
  const parsed = parseSchema(
    workOrderStatusTransitionWithAssignmentSchema,
    input.payload,
  );
  if (!parsed.ok) {
    return parsed;
  }

  const workOrder = await dependencies.workOrders.getById(input.workOrderId);
  if (!workOrder) {
    return serviceFail(notFoundError("Work order could not be found."));
  }

  const activeAssignment = await dependencies.assignments.getActiveByWorkOrderId(
    workOrder.id,
  );

  const actionAvailability = getAllowedWorkOrderActions({
    actor,
    workOrder: toModuleWorkOrder(workOrder),
    activeAssignment: activeAssignment ? toModuleAssignment(activeAssignment) : null,
  });

  if (!actionAvailability.availableStatusTransitions.includes(parsed.value.status)) {
    return serviceFail(
      conflictError(
        `Work order cannot transition from ${workOrder.status} to ${parsed.value.status}.`,
      ),
    );
  }

  const updated = await dependencies.workOrders.updateStatus({
    workOrderId: workOrder.id,
    status: parsed.value.status,
    closedAt: parsed.value.status === "CLOSED" ? input.now ?? new Date().toISOString() : null,
    now: input.now,
  });
  if (!updated) {
    return serviceFail(notFoundError("Work order could not be found."));
  }

  await dependencies.activityLogs.record({
    ...input,
    workOrderId: updated.id,
    action: "work_order.status_changed",
    eventType: "status_changed",
    message: `Transitioned work order from ${workOrder.status} to ${updated.status}.`,
    entityType: "workOrder",
    entityId: updated.id,
    entityLabel: updated.workOrderNumber,
    visibility: "internal",
    changes: [{ field: "status", from: workOrder.status, to: updated.status }],
    metadata: {
      activeAssignmentId: activeAssignment?.id ?? null,
    },
  });

  return serviceOk(updated);
}

async function createAssignmentRecord(
  dependencies: AssignmentWorkflowDependencies,
  input: CreateAssignmentServiceInput | ReassignAssignmentServiceInput,
  payload: CreateAssignmentDto | ReassignAssignmentDto,
  previousAssignmentId: EntityId | null,
): Promise<ServiceResult<RepositoryAssignment>> {
  if (payload.workOrderId !== input.workOrderId) {
    return serviceFail(validationError("workOrderId must match the selected work order."));
  }

  const workOrder = await dependencies.workOrders.getById(input.workOrderId);
  if (!workOrder) {
    return serviceFail(notFoundError("Work order could not be found."));
  }

  if (!canAssignWorkOrderFromAudit(input)) {
    return serviceFail(validationError("You are not allowed to assign this work order."));
  }

  if (workOrder.status === "CLOSED" || workOrder.status === "CANCELLED") {
    return serviceFail(
      conflictError("Assignments cannot be created for terminal work orders."),
    );
  }

  if ("currentAssignmentId" in payload === false) {
    const activeAssignment = await dependencies.assignments.getActiveByWorkOrderId(
      workOrder.id,
    );
    if (activeAssignment) {
      return serviceFail(
        conflictError("This work order already has an active assignment."),
      );
    }
  }

  const assigneeProfile = await dependencies.userProfiles.getById(payload.assigneeUserId);
  if (!assigneeProfile || assigneeProfile.isDeleted || assigneeProfile.status !== "active") {
    return serviceFail(notFoundError("Assignee user could not be found."));
  }

  if (!isValidAssigneeType(payload.assigneeType, assigneeProfile.role)) {
    return serviceFail(
      validationError("Selected assignee does not match the requested assigneeType."),
    );
  }

  if (
    payload.assigneeType === "contractor" &&
    !assigneeProfile.contractorOrganizationId
  ) {
    return serviceFail(
      validationError("Contractor assignees must belong to a contractor organization."),
    );
  }

  const now = input.now ?? new Date().toISOString();
  const assignment: RepositoryAssignment = {
    id: dependencies.assignments.newId(),
    organizationId: input.organizationId,
    recordStatus: "active",
    isDeleted: false,
    createdAt: now,
    updatedAt: now,
    createdByUserId: input.actor.userId,
    updatedByUserId: input.actor.userId,
    workOrderId: workOrder.id,
    contractorOrganizationId:
      payload.assigneeType === "contractor"
        ? assigneeProfile.contractorOrganizationId
        : null,
    assigneeType: payload.assigneeType,
    assigneeUserId: assigneeProfile.id,
    assigneeOrganizationId:
      payload.assigneeType === "contractor"
        ? assigneeProfile.contractorOrganizationId
        : input.organizationId,
    assignedByUserId: input.actor.userId,
    status: "assigned",
    scheduledDate: payload.scheduledDate ?? null,
    timeWindowStart: payload.timeWindowStart ?? null,
    timeWindowEnd: payload.timeWindowEnd ?? null,
    assignedAt: now,
    acceptedAt: null,
    declinedAt: null,
    completedAt: null,
    notes: payload.notes?.trim() || null,
    workOrderSnapshot: {
      id: workOrder.id,
      name: workOrder.workOrderNumber,
    },
    contractorSnapshot:
      payload.assigneeType === "contractor" && assigneeProfile.contractorOrganizationId
        ? {
            id: assigneeProfile.contractorOrganizationId,
            name: assigneeProfile.contractorOrganizationId,
          }
        : null,
  };

  await dependencies.assignments.create(assignment);

  const nextStatus = workOrder.status === "NEW" || workOrder.status === "OPEN"
    ? "ASSIGNED"
    : workOrder.status;
  if (nextStatus !== workOrder.status) {
    await dependencies.workOrders.updateStatus({
      workOrderId: workOrder.id,
      status: nextStatus,
      now,
    });
  }

  await dependencies.activityLogs.record({
    ...input,
    workOrderId: workOrder.id,
    action: previousAssignmentId ? "assignment.reassigned" : "assignment.created",
    eventType: previousAssignmentId ? "assignment_reassigned" : "assignment_created",
    message: previousAssignmentId
      ? "Created replacement assignment."
      : "Created assignment.",
    entityType: "assignment",
    entityId: assignment.id,
    entityLabel: assigneeProfile.displayName?.trim() || assigneeProfile.email,
    visibility: "internal",
    changes: [
      { field: "status", to: assignment.status },
      { field: "assigneeUserId", to: assignment.assigneeUserId },
    ],
    metadata: {
      assigneeType: assignment.assigneeType,
      previousAssignmentId,
      scheduledDate: assignment.scheduledDate,
    },
  });

  return serviceOk(assignment);
}

async function updateAssignmentStatus(
  dependencies: AssignmentWorkflowDependencies,
  input: UpdateAssignmentStateServiceInput,
  assignmentId: EntityId,
  nextStatus: "accepted" | "declined" | "completed",
  payload?: DeclineAssignmentDto | { notes?: string | null },
): Promise<ServiceResult<RepositoryAssignment>> {
  const assignment = await dependencies.assignments.getById(assignmentId);
  if (
    !assignment ||
    assignment.isDeleted ||
    assignment.workOrderId !== input.workOrderId
  ) {
    return serviceFail(notFoundError("Assignment could not be found."));
  }

  if (!canAssignmentStatusTransition(assignment.status, nextStatus)) {
    return serviceFail(
      conflictError(
        `Assignment cannot transition from ${assignment.status} to ${nextStatus}.`,
      ),
    );
  }

  if (
    nextStatus === "completed"
      ? !canActorCompleteAssignmentFromAudit(input, assignment)
      : !canActorRespondToAssignmentFromAudit(input, assignment)
  ) {
    return serviceFail(validationError("You are not allowed to update this assignment."));
  }

  const now = input.now ?? new Date().toISOString();
  const updated: RepositoryAssignment = {
    ...assignment,
    status: nextStatus,
    notes:
      payload?.notes === undefined ? assignment.notes : payload.notes?.trim() || null,
    acceptedAt: nextStatus === "accepted" ? assignment.acceptedAt ?? now : assignment.acceptedAt,
    declinedAt: nextStatus === "declined" ? assignment.declinedAt ?? now : assignment.declinedAt,
    completedAt:
      nextStatus === "completed" ? assignment.completedAt ?? now : assignment.completedAt,
    updatedAt: now,
    updatedByUserId: input.actor.userId,
  };

  await dependencies.assignments.save(updated);
  await dependencies.activityLogs.record({
    ...input,
    workOrderId: updated.workOrderId,
    action: "assignment.status_changed",
    eventType: "assignment_status_changed",
    message: `Updated assignment status from ${assignment.status} to ${updated.status}.`,
    entityType: "assignment",
    entityId: updated.id,
    entityLabel: updated.contractorSnapshot?.name ?? updated.assigneeUserId,
    visibility: "internal",
    changes: [{ field: "status", from: assignment.status, to: updated.status }],
  });

  return serviceOk(updated);
}

function getAllowedStatusTransitions(
  input: WorkOrderActionAvailabilityContext,
): readonly WorkOrderStatus[] {
  const transitions: WorkOrderStatus[] = [];
  const { actor, workOrder, activeAssignment } = input;

  if ((workOrder.status === "NEW" || workOrder.status === "OPEN") && canAssignWorkOrder(actor)) {
    if (activeAssignment) {
      transitions.push("ASSIGNED");
    }
  }

  if (workOrder.status === "ASSIGNED") {
    if (activeAssignment?.status === "accepted" && canStartAssignedWork(actor)) {
      transitions.push("IN_PROGRESS");
    }
    if (canAssignWorkOrder(actor)) {
      transitions.push("CANCELLED");
    }
  }

  if (workOrder.status === "IN_PROGRESS") {
    if (canMarkWorkOrderCompleted(actor, activeAssignment)) {
      transitions.push("COMPLETED");
    }
    if (canAssignWorkOrder(actor)) {
      transitions.push("CANCELLED");
    }
  }

  if (workOrder.status === "COMPLETED" && canMoveToReadyForInvoicing(actor)) {
    transitions.push("READY_FOR_INVOICING");
  }

  if (workOrder.status === "READY_FOR_INVOICING" && canMoveToReadyForInvoicing(actor)) {
    transitions.push("CLOSED");
  }

  if ((workOrder.status === "NEW" || workOrder.status === "OPEN") && canAssignWorkOrder(actor)) {
    transitions.push("CANCELLED");
  }

  if (workOrder.status === "CANCELLED" && isInternalOperationsRole(actor.role)) {
    transitions.push("CLOSED");
  }

  return transitions;
}

function canAssignWorkOrder(actor: AccessActor): boolean {
  return actor.actorType === "internal" && ASSIGNMENT_OPERATIONS_ROLES.has(actor.role);
}

function canAssignWorkOrderFromAudit(input: ServiceAuditContext): boolean {
  return isInternalOperationsRole(input.actor.role);
}

function canActorRespondToAssignment(
  actor: AccessActor,
  assignment: Assignment | null,
): boolean {
  if (!assignment) {
    return false;
  }

  return actor.userId === assignment.assigneeUserId || actor.role === USER_ROLES.Owner;
}

function canActorRespondToAssignmentFromAudit(
  input: ServiceAuditContext,
  assignment: RepositoryAssignment,
): boolean {
  return input.actor.userId === assignment.assigneeUserId || input.actor.role === USER_ROLES.Owner;
}

function canActorCompleteAssignment(
  actor: AccessActor,
  assignment: Assignment | null,
): boolean {
  if (!assignment) {
    return false;
  }

  return (
    actor.userId === assignment.assigneeUserId ||
    (actor.actorType === "internal" &&
      ASSIGNMENT_COMPLETION_OVERRIDE_ROLES.has(actor.role))
  );
}

function canActorCompleteAssignmentFromAudit(
  input: ServiceAuditContext,
  assignment: RepositoryAssignment,
): boolean {
  return (
    input.actor.userId === assignment.assigneeUserId ||
    isInternalOperationsRole(input.actor.role)
  );
}

function canStartAssignedWork(actor: AccessActor): boolean {
  return actor.actorType === "internal" || actor.role === USER_ROLES.ContractorUser;
}

function canMarkWorkOrderCompleted(
  actor: AccessActor,
  activeAssignment: Assignment | null,
): boolean {
  if (!activeAssignment) {
    return false;
  }

  return canActorCompleteAssignment(actor, activeAssignment);
}

function canMoveToReadyForInvoicing(actor: AccessActor): boolean {
  return (
    actor.actorType === "internal" &&
    (isInternalOperationsRole(actor.role) || actor.role === USER_ROLES.FinanceAdmin)
  );
}

function canAssignmentStatusTransition(
  from: AssignmentStatus,
  to: AssignmentStatus,
): boolean {
  const transitions: Record<AssignmentStatus, readonly AssignmentStatus[]> = {
    assigned: ["accepted", "declined", "cancelled"],
    accepted: ["completed", "cancelled"],
    declined: [],
    completed: [],
    cancelled: [],
  };

  return transitions[from].includes(to);
}

function isActiveAssignmentStatus(status: AssignmentStatus): boolean {
  return status === "assigned" || status === "accepted";
}

function isInternalOperationsRole(role: string): role is InternalUserRole {
  return ASSIGNMENT_OPERATIONS_ROLES.has(role as InternalUserRole);
}

function isValidAssigneeType(
  assigneeType: Assignment["assigneeType"],
  role: string,
): boolean {
  if (assigneeType === "contractor") {
    return role === USER_ROLES.ContractorUser;
  }

  return (
    role === USER_ROLES.Coordinator ||
    role === USER_ROLES.Manager ||
    role === USER_ROLES.Owner
  );
}

function parseSchema<T>(
  schema: z.ZodType<T>,
  payload: unknown,
): ServiceResult<T> {
  const result = schema.safeParse(payload);
  if (result.success) {
    return serviceOk(result.data);
  }

  return serviceFail(validationError(z.prettifyError(result.error)));
}

function toModuleWorkOrder(
  workOrder: NonNullable<Awaited<ReturnType<PhaseThreeWorkOrderRepository["getById"]>>>,
): WorkOrder {
  return workOrder as WorkOrder;
}

function toModuleAssignment(assignment: RepositoryAssignment): Assignment {
  return {
    id: assignment.id,
    workOrderId: assignment.workOrderId,
    assigneeType: assignment.assigneeType,
    assigneeUserId: assignment.assigneeUserId,
    assigneeOrganizationId: assignment.assigneeOrganizationId,
    assignedByUserId: assignment.assignedByUserId,
    status: assignment.status,
    scheduledDate: assignment.scheduledDate,
    timeWindowStart: assignment.timeWindowStart,
    timeWindowEnd: assignment.timeWindowEnd,
    assignedAt: assignment.assignedAt,
    acceptedAt: assignment.acceptedAt,
    declinedAt: assignment.declinedAt,
    completedAt: assignment.completedAt,
    notes: assignment.notes,
    createdAt: assignment.createdAt,
    updatedAt: assignment.updatedAt,
  };
}
