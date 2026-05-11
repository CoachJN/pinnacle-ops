import "server-only";

import {
  canAssignmentTransition,
  canManageAssignments,
  canOverrideAssignmentCompletion,
  getContractorAssignmentEligibility,
  isActiveAssignmentStatus,
  isTerminalAssignmentWorkOrderStatus,
} from "@/modules/work-orders";
import type {
  Assignment,
  ContractorOrganization,
  FirestoreRepositories,
} from "@/server/repositories";
import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { AssignmentStatus } from "@/types/work-order";
import type { DomainEventService } from "./domain-event-service";
import type { NotificationService } from "./notification-service";
import type { WorkOrderService } from "./work-order-service";
import type { AtomicPersistenceService, AtomicPersistenceContext } from "./atomic-persistence-service";
import { createServiceLogger } from "./observability";
import { conflictError, notFoundError, validationError } from "./errors";
import {
  createAuditFields,
  serviceFail,
  serviceOk,
  touchAuditFields,
  type ServiceResult,
} from "./types";
import type { WorkOrderMutationContext } from "./work-order-mutation-context";

export interface AssignmentService {
  assignContractor(
    input: AssignContractorInput,
  ): Promise<ServiceResult<Assignment>>;
  reassignContractor(
    input: ReassignContractorInput,
  ): Promise<ServiceResult<Assignment>>;
  listForWorkOrder(workOrderId: EntityId): Promise<ServiceResult<Assignment[]>>;
  getActiveForWorkOrder(
    workOrderId: EntityId,
  ): Promise<ServiceResult<Assignment | null>>;
  listAssignableContractors(
    input: ListAssignableContractorsInput,
  ): Promise<ServiceResult<AssignableContractorOption[]>>;
  updateStatus(input: UpdateAssignmentStatusInput): Promise<ServiceResult<Assignment>>;
  assign(input: AssignContractorInput): Promise<ServiceResult<Assignment>>;
}

export interface AssignContractorInput extends WorkOrderMutationContext {
  workOrderId: EntityId;
  contractorOrganizationId: EntityId;
  scheduledDate?: IsoDateTimeString | null;
  timeWindowStart?: IsoDateTimeString | null;
  timeWindowEnd?: IsoDateTimeString | null;
  notes?: string | null;
}

export interface ReassignContractorInput extends AssignContractorInput {
  currentAssignmentId: EntityId;
}

export interface UpdateAssignmentStatusInput extends WorkOrderMutationContext {
  assignmentId: EntityId;
  workOrderId: EntityId;
  status: AssignmentStatus;
  notes?: string | null;
}

export interface ListAssignableContractorsInput {
  organizationId: EntityId;
  workOrderCategory: string | null;
}

export interface AssignableContractorOption {
  id: EntityId;
  label: string;
  status: ContractorOrganization["status"];
  parentContractorId: EntityId | null;
  trades: string[];
  isAssignable: boolean;
  reason: string | null;
}

export function createAssignmentService(
  repositories: Pick<
    FirestoreRepositories,
    "assignments" | "workOrders" | "contractorOrganizations" | "userProfiles"
  >,
  dependencies: {
    domainEvents: DomainEventService;
    workOrders: Pick<WorkOrderService, "applyContractorAssignment">;
    notifications?: NotificationService;
    atomicPersistence?: AtomicPersistenceService;
  },
): AssignmentService {
  return new FirestoreAssignmentService(repositories, dependencies);
}

class FirestoreAssignmentService implements AssignmentService {
  private readonly repositories: Pick<
    FirestoreRepositories,
    "assignments" | "workOrders" | "contractorOrganizations" | "userProfiles"
  >;

  private readonly dependencies: {
    domainEvents: DomainEventService;
    workOrders: Pick<WorkOrderService, "applyContractorAssignment">;
    notifications?: NotificationService;
    atomicPersistence?: AtomicPersistenceService;
  };

  constructor(
    repositories: Pick<
      FirestoreRepositories,
      "assignments" | "workOrders" | "contractorOrganizations" | "userProfiles"
    >,
    dependencies: {
      domainEvents: DomainEventService;
      workOrders: Pick<WorkOrderService, "applyContractorAssignment">;
      notifications?: NotificationService;
      atomicPersistence?: AtomicPersistenceService;
    },
  ) {
    this.repositories = repositories;
    this.dependencies = dependencies;
  }

  async assign(input: AssignContractorInput): Promise<ServiceResult<Assignment>> {
    return this.assignContractor(input);
  }

  async assignContractor(
    input: AssignContractorInput,
  ): Promise<ServiceResult<Assignment>> {
    const logger = createServiceLogger("assignment.assign_contractor", input);
    const workOrder = await this.getExistingWorkOrder(input.workOrderId);
    if (!workOrder.ok) {
      return workOrder;
    }

    const authorization = this.assertCanManageAssignments(input);
    if (!authorization.ok) {
      return authorization;
    }

    if (isTerminalAssignmentWorkOrderStatus(workOrder.value.lifecycleStatus)) {
      return serviceFail(
        conflictError("Contractors cannot be assigned to terminal work orders."),
      );
    }

    const activeAssignment = await this.repositories.assignments.getActiveByWorkOrderId(
      workOrder.value.id,
    );
    if (activeAssignment) {
      return serviceFail(
        conflictError("This work order already has an active contractor assignment."),
      );
    }

    const contractor = await this.getEligibleContractor(
      input.contractorOrganizationId,
      workOrder.value.category ?? null,
    );
    if (!contractor.ok) {
      return contractor;
    }

    const assignment = this.buildAssignment({
      input,
      workOrderId: workOrder.value.id,
      workOrderNumber: workOrder.value.workOrderNumber,
      contractor: contractor.value,
    });

    const persistAssignment = async (atomic?: AtomicPersistenceContext) => {
      if (atomic) {
        atomic.create("assignments", assignment);
      } else {
        await this.repositories.assignments.create(assignment);
      }
      const workOrderUpdate = await this.dependencies.workOrders.applyContractorAssignment({
        ...input,
        atomic,
        source: "assignment_workflow",
        workOrderId: workOrder.value.id,
        contractorOrganizationId: contractor.value.id,
        assignedAt: assignment.assignedAt,
      });
      if (!workOrderUpdate.ok) {
        return workOrderUpdate;
      }
      await this.dependencies.domainEvents.record({
        ...input,
        atomic,
        now: assignment.assignedAt,
        workOrderId: workOrder.value.id,
        type: "assignment_created",
        visibility: "internal",
        lifecycleStatus: workOrderUpdate.value.lifecycleStatus,
        entity: {
          entityType: "assignment",
          entityId: assignment.id,
          label: assignment.contractorSnapshot?.name ?? contractor.value.id,
        },
        summary: `Assigned ${assignment.contractorSnapshot?.name ?? contractor.value.id}.`,
        payload: {
          assignmentId: assignment.id,
          contractorOrganizationId: assignment.contractorOrganizationId,
          status: assignment.status,
        },
      });
      await this.dependencies.domainEvents.record({
        ...input,
        atomic,
        now: assignment.assignedAt,
        workOrderId: workOrder.value.id,
        type: "contractor_contacted",
        visibility: "contractor",
        lifecycleStatus: workOrderUpdate.value.lifecycleStatus,
        entity: {
          entityType: "assignment",
          entityId: assignment.id,
          label: assignment.contractorSnapshot?.name ?? contractor.value.id,
        },
        summary: `Contacted ${assignment.contractorSnapshot?.name ?? contractor.value.id} for assignment.`,
        payload: {
          assignmentId: assignment.id,
          contractorOrganizationId: assignment.contractorOrganizationId,
        },
      });
      return serviceOk(workOrderUpdate.value);
    };

    const workOrderUpdate = this.dependencies.atomicPersistence
      ? await this.dependencies.atomicPersistence.runInTransaction((atomic) =>
          persistAssignment(atomic),
        )
      : await persistAssignment();
    if (!workOrderUpdate.ok) {
      return workOrderUpdate;
    }
    logger.info("use_case.completed", {
      action: "assignment.created",
      resource: {
        type: "assignment",
        id: assignment.id,
        label: assignment.contractorSnapshot?.name ?? contractor.value.id,
      },
      workOrderId: workOrder.value.id,
    });

    await this.dependencies.notifications?.captureOperationalEvent({
      ...input,
      now: assignment.assignedAt,
      eventType: "contractor_assigned",
      entityType: "assignment",
      entityId: assignment.id,
      workOrder: workOrder.value,
      assignment,
      contractorName: assignment.contractorSnapshot?.name ?? contractor.value.name,
      toStatus: assignment.status,
    });

    return serviceOk(assignment);
  }

  async reassignContractor(
    input: ReassignContractorInput,
  ): Promise<ServiceResult<Assignment>> {
    const logger = createServiceLogger("assignment.reassign_contractor", input);
    const workOrder = await this.getExistingWorkOrder(input.workOrderId);
    if (!workOrder.ok) {
      return workOrder;
    }

    const authorization = this.assertCanManageAssignments(input);
    if (!authorization.ok) {
      return authorization;
    }

    if (isTerminalAssignmentWorkOrderStatus(workOrder.value.lifecycleStatus)) {
      return serviceFail(
        conflictError("Contractors cannot be reassigned on terminal work orders."),
      );
    }

    const currentAssignment = await this.repositories.assignments.getById(
      input.currentAssignmentId,
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

    const contractor = await this.getEligibleContractor(
      input.contractorOrganizationId,
      workOrder.value.category ?? null,
    );
    if (!contractor.ok) {
      return contractor;
    }

    const now = input.now ?? new Date().toISOString();
    await this.repositories.assignments.save(
      touchAuditFields(
        {
          ...currentAssignment,
          status: "cancelled",
          notes: currentAssignment.notes,
        },
        { ...input, now },
      ),
    );
    const created = await this.assignContractor({
      ...input,
      now,
      contractorOrganizationId: contractor.value.id,
    });
    if (created.ok) {
      logger.info("use_case.completed", {
        action: "assignment.reassigned",
        previousAssignmentId: currentAssignment.id,
        nextAssignmentId: created.value.id,
      });
    }
    return created;
  }

  async listForWorkOrder(workOrderId: EntityId): Promise<ServiceResult<Assignment[]>> {
    const result = await this.repositories.assignments.listByWorkOrderId(workOrderId);
    return serviceOk(result.items);
  }

  async getActiveForWorkOrder(
    workOrderId: EntityId,
  ): Promise<ServiceResult<Assignment | null>> {
    return serviceOk(await this.repositories.assignments.getActiveByWorkOrderId(workOrderId));
  }

  async listAssignableContractors(
    input: ListAssignableContractorsInput,
  ): Promise<ServiceResult<AssignableContractorOption[]>> {
    const contractors =
      await this.repositories.contractorOrganizations.listByOrganizationId(
        input.organizationId,
        { limit: 200 },
      );

    return serviceOk(
      contractors.items
        .filter((contractor) => !contractor.isDeleted)
        .map((contractor) => {
          const parent = contractor.parentContractorId
            ? contractors.items.find(
                (candidate) => candidate.id === contractor.parentContractorId,
              ) ?? null
            : null;
          const eligibility = getContractorAssignmentEligibility({
            status: contractor.status,
            isAssignable: contractor.isAssignable,
            trades: contractor.trades,
            workOrderCategory: input.workOrderCategory,
          });

          return {
            id: contractor.id,
            label: buildContractorOptionLabel(contractor, parent),
            status: contractor.status,
            parentContractorId: contractor.parentContractorId ?? null,
            trades: contractor.trades ?? [],
            isAssignable: eligibility.isAssignable,
            reason: eligibility.reason,
          };
        })
        .sort((left, right) => {
          if (left.isAssignable !== right.isAssignable) {
            return left.isAssignable ? -1 : 1;
          }

          return left.label.localeCompare(right.label);
        }),
    );
  }

  async updateStatus(
    input: UpdateAssignmentStatusInput,
  ): Promise<ServiceResult<Assignment>> {
    const logger = createServiceLogger("assignment.update_status", input);
    const assignment = await this.repositories.assignments.getById(
      input.assignmentId,
    );
    if (!assignment || assignment.isDeleted || assignment.workOrderId !== input.workOrderId) {
      return serviceFail(
        notFoundError("Assignment could not be found for this work order."),
      );
    }

    if (!canAssignmentTransition(assignment.status, input.status)) {
      return serviceFail(
        conflictError(
          `Assignment cannot transition from ${assignment.status} to ${input.status}.`,
        ),
      );
    }

    const authorization = await this.assertCanUpdateAssignmentStatus(input, assignment);
    if (!authorization.ok) {
      return authorization;
    }

    const timestamp = input.now ?? new Date().toISOString();
    const updated = touchAuditFields(
      {
        ...assignment,
        status: input.status,
        notes: input.notes ?? assignment.notes,
        acceptedAt:
          input.status === "accepted"
            ? assignment.acceptedAt ?? timestamp
            : assignment.acceptedAt,
        declinedAt:
          input.status === "declined"
            ? assignment.declinedAt ?? timestamp
            : assignment.declinedAt,
        completedAt:
          input.status === "completed"
            ? assignment.completedAt ?? timestamp
            : assignment.completedAt,
      },
      { ...input, now: timestamp },
    );

    const persistStatus = async (atomic?: AtomicPersistenceContext) => {
      if (atomic) {
        atomic.save("assignments", updated);
      } else {
        await this.repositories.assignments.save(updated);
      }
      if (input.status === "accepted" || input.status === "declined") {
        await this.dependencies.domainEvents.record({
          ...input,
          atomic,
          now: timestamp,
          workOrderId: assignment.workOrderId,
          type: input.status === "accepted" ? "assignment_accepted" : "assignment_declined",
          visibility: input.actor.role === "contractor_user" ? "contractor" : "internal",
          lifecycleStatus: null,
          entity: {
            entityType: "assignment",
            entityId: assignment.id,
            label: assignment.contractorSnapshot?.name ?? assignment.assigneeUserId,
          },
          summary: `Changed assignment status from ${assignment.status} to ${input.status}.`,
          payload:
            input.status === "accepted"
              ? {
                  assignmentId: assignment.id,
                  status: input.status,
                }
              : {
                  assignmentId: assignment.id,
                  status: input.status,
                  notes: input.notes ?? null,
                },
        });
      }
      return serviceOk(true);
    };

    const persisted = this.dependencies.atomicPersistence
      ? await this.dependencies.atomicPersistence.runInTransaction((atomic) =>
          persistStatus(atomic),
        )
      : await persistStatus();
    if (!persisted.ok) {
      return persisted;
    }
    logger.info("use_case.completed", {
      action: "assignment.status_changed",
      resource: {
        type: "assignment",
        id: assignment.id,
        label: assignment.contractorSnapshot?.name ?? assignment.assigneeUserId,
      },
      fromStatus: assignment.status,
      toStatus: input.status,
    });

    const notificationEventType =
      input.status === "accepted"
        ? "contractor_accepted"
        : input.status === "declined"
          ? "contractor_declined"
          : input.status === "completed"
            ? "contractor_completed_assignment"
            : null;

    if (notificationEventType) {
      const workOrder = await this.repositories.workOrders.getById(assignment.workOrderId);
      await this.dependencies.notifications?.captureOperationalEvent({
        ...input,
        now: timestamp,
        eventType: notificationEventType,
        entityType: "assignment",
        entityId: assignment.id,
        workOrder,
        assignment: updated,
        contractorName: assignment.contractorSnapshot?.name ?? null,
        fromStatus: assignment.status,
        toStatus: input.status,
      });
    }

    return serviceOk(updated);
  }

  private async getExistingWorkOrder(workOrderId: EntityId): Promise<ServiceResult<
    NonNullable<Awaited<ReturnType<typeof this.repositories.workOrders.getById>>>
  >> {
    const workOrder = await this.repositories.workOrders.getById(workOrderId);
    if (!workOrder || workOrder.isDeleted) {
      return serviceFail(notFoundError("Work order could not be found."));
    }

    return serviceOk(workOrder);
  }

  private async getEligibleContractor(
    contractorOrganizationId: EntityId,
    workOrderCategory: string | null,
  ): Promise<ServiceResult<ContractorOrganization>> {
    if (!contractorOrganizationId.trim()) {
      return serviceFail(validationError("Contractor organization is required."));
    }

    const contractor =
      await this.repositories.contractorOrganizations.getById(
        contractorOrganizationId,
      );
    if (!contractor || contractor.isDeleted) {
      return serviceFail(
        notFoundError("Contractor organization could not be found."),
      );
    }

    const eligibility = getContractorAssignmentEligibility({
      status: contractor.status,
      isAssignable: contractor.isAssignable,
      trades: contractor.trades,
      workOrderCategory,
    });
    if (!eligibility.isAssignable) {
      return serviceFail(validationError(eligibility.reason ?? "Contractor is not assignable."));
    }

    return serviceOk(contractor);
  }

  private assertCanManageAssignments(
    input: WorkOrderMutationContext,
  ): ServiceResult<true> {
    if (!canManageAssignments(input.actor.role)) {
      return serviceFail(validationError("You are not allowed to manage assignments."));
    }

    return serviceOk(true);
  }

  private async assertCanUpdateAssignmentStatus(
    input: UpdateAssignmentStatusInput,
    assignment: Assignment,
  ): Promise<ServiceResult<true>> {
    if (input.status === "accepted" || input.status === "declined") {
      const profile = await this.repositories.userProfiles.getById(input.actor.userId);
      if (
        input.actor.role === "contractor_user" &&
        profile?.contractorOrganizationId === assignment.contractorOrganizationId
      ) {
        return serviceOk(true);
      }

      if (
        input.actor.role !== "contractor_user" &&
        canManageAssignments(input.actor.role)
      ) {
        return serviceOk(true);
      }

      return serviceFail(validationError("You are not allowed to update this assignment."));
    }

    if (
      canOverrideAssignmentCompletion(input.actor.role) ||
      (input.actor.role === "contractor_user" &&
        assignment.contractorOrganizationId !== null)
    ) {
      const profile = await this.repositories.userProfiles.getById(input.actor.userId);
      if (
        input.actor.role !== "contractor_user" ||
        profile?.contractorOrganizationId === assignment.contractorOrganizationId
      ) {
        return serviceOk(true);
      }
    }

    return serviceFail(validationError("You are not allowed to update this assignment."));
  }

  private buildAssignment(input: {
    input: AssignContractorInput;
    workOrderId: EntityId;
    workOrderNumber: string;
    contractor: ContractorOrganization;
  }): Assignment {
    const assignedAt = input.input.now ?? new Date().toISOString();
    return {
      id: this.repositories.assignments.newId(),
      ...createAuditFields({ ...input.input, now: assignedAt }),
      workOrderId: input.workOrderId,
      contractorOrganizationId: input.contractor.id,
      assigneeType: "contractor",
      assigneeUserId: input.input.actor.userId,
      assigneeOrganizationId: input.contractor.id,
      assignedByUserId: input.input.actor.userId,
      status: "assigned",
      scheduledDate: input.input.scheduledDate ?? null,
      timeWindowStart: input.input.timeWindowStart ?? null,
      timeWindowEnd: input.input.timeWindowEnd ?? null,
      assignedAt,
      acceptedAt: null,
      declinedAt: null,
      completedAt: null,
      notes: input.input.notes?.trim() || null,
      workOrderSnapshot: {
        id: input.workOrderId,
        name: input.workOrderNumber,
      },
      contractorSnapshot: {
        id: input.contractor.id,
        name: input.contractor.displayName ?? input.contractor.name,
      },
    };
  }

}

function buildContractorOptionLabel(
  contractor: ContractorOrganization,
  parent: ContractorOrganization | null,
): string {
  const contractorLabel = contractor.displayName ?? contractor.name;
  if (!parent) {
    return contractorLabel;
  }

  return `${parent.displayName ?? parent.name} - ${contractorLabel}`;
}
