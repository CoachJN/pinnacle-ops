import "server-only";

import type { Assignment, FirestoreRepositories } from "@/server/repositories";
import type { EntityId } from "@/types/entity";
import type { AssignmentStatus } from "@/types/work-order";
import type { ActivityLogService } from "./activity-log-service";
import type { ContractorService } from "./contractor-service";
import { createServiceLogger } from "./observability";
import { conflictError, notFoundError, validationError } from "./errors";
import {
  createAuditFields,
  serviceFail,
  serviceOk,
  touchAuditFields,
  type ServiceAuditContext,
  type ServiceResult,
} from "./types";

export interface AssignmentService {
  assign(input: AssignContractorInput): Promise<ServiceResult<Assignment>>;
  updateStatus(input: UpdateAssignmentStatusInput): Promise<ServiceResult<Assignment>>;
}

export interface AssignContractorInput extends ServiceAuditContext {
  workOrderId: EntityId;
  contractorOrganizationId: EntityId;
  notes?: string | null;
}

export interface UpdateAssignmentStatusInput extends ServiceAuditContext {
  assignmentId: EntityId;
  workOrderId: EntityId;
  status: AssignmentStatus;
  notes?: string | null;
}

export function createAssignmentService(
  repositories: Pick<
    FirestoreRepositories,
    "assignments" | "workOrders" | "contractorOrganizations"
  >,
  dependencies: {
    activityLogs: ActivityLogService;
    contractors: ContractorService;
  },
): AssignmentService {
  return new FirestoreAssignmentService(repositories, dependencies);
}

class FirestoreAssignmentService implements AssignmentService {
  constructor(
    private readonly repositories: Pick<
      FirestoreRepositories,
      "assignments" | "workOrders" | "contractorOrganizations"
    >,
    private readonly dependencies: {
      activityLogs: ActivityLogService;
      contractors: ContractorService;
    },
  ) {}

  async assign(input: AssignContractorInput): Promise<ServiceResult<Assignment>> {
    const logger = createServiceLogger("assignment.assign", input);
    const [workOrder, contractor] = await Promise.all([
      this.repositories.workOrders.getById(input.workOrderId),
      this.dependencies.contractors.getContractorOrganization(
        input.contractorOrganizationId,
      ),
    ]);

    if (!workOrder || workOrder.isDeleted) {
      return serviceFail(notFoundError("Work order could not be found."));
    }

    if (!contractor.ok) {
      return contractor;
    }

    if (contractor.value.status !== "active") {
      return serviceFail(
        notFoundError("Active contractor organization could not be found."),
      );
    }

    if (workOrder.status === "closed" || workOrder.status === "cancelled") {
      return serviceFail(
        conflictError("Contractors cannot be assigned to terminal work orders."),
      );
    }

    const existingAssignments =
      await this.repositories.assignments.listByWorkOrderId(workOrder.id);
    const activeAssignment = existingAssignments.items.find(
      (assignment) =>
        assignment.status === "pending" || assignment.status === "accepted",
    );
    if (activeAssignment) {
      return serviceFail(
        validationError("This work order already has an active assignment."),
      );
    }

    const assignedAt = input.now ?? new Date().toISOString();
    const assignment: Assignment = {
      id: this.repositories.assignments.newId(),
      ...createAuditFields({ ...input, now: assignedAt }),
      workOrderId: workOrder.id,
      contractorOrganizationId: contractor.value.id,
      assignedByUserId: input.actor.userId,
      status: "pending",
      assignedAt,
      respondedAt: null,
      completedAt: null,
      notes: input.notes ?? null,
      workOrderSnapshot: {
        id: workOrder.id,
        name: workOrder.workOrderNumber,
      },
      contractorSnapshot: {
        id: contractor.value.id,
        name: contractor.value.displayName ?? contractor.value.name,
      },
    };

    await this.repositories.assignments.create(assignment);
    await this.repositories.workOrders.save(
      touchAuditFields(
        {
          ...workOrder,
          assignedContractorOrganizationId: contractor.value.id,
          contractorSnapshot: assignment.contractorSnapshot,
          status: workOrder.status === "approved_to_proceed" ? "assigned" : workOrder.status,
        },
        input,
      ),
    );
    await this.dependencies.activityLogs.record({
      ...input,
      now: assignedAt,
      workOrderId: workOrder.id,
      action: "assignment.created",
      eventType: "contractor_assigned",
      message: `Assigned ${assignment.contractorSnapshot.name}.`,
      entityType: "assignment",
      entityId: assignment.id,
      entityLabel: assignment.contractorSnapshot.name,
      visibility: "internal",
      changes: [
        { field: "status", to: assignment.status },
        { field: "contractorOrganizationId", to: assignment.contractorOrganizationId },
      ],
      metadata: {
        contractorOrganizationId: assignment.contractorOrganizationId,
        contractorName: assignment.contractorSnapshot.name,
      },
    });
    logger.info("use_case.completed", {
      action: "assignment.created",
      resource: {
        type: "assignment",
        id: assignment.id,
        label: assignment.contractorSnapshot.name,
      },
      workOrderId: workOrder.id,
    });

    return serviceOk(assignment);
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

    const timestamp = input.now ?? new Date().toISOString();
    const updated = touchAuditFields(
      {
        ...assignment,
        status: input.status,
        notes: input.notes ?? assignment.notes,
        respondedAt:
          input.status === "accepted" || input.status === "declined"
            ? assignment.respondedAt ?? timestamp
            : assignment.respondedAt,
        completedAt:
          input.status === "completed"
            ? assignment.completedAt ?? timestamp
            : assignment.completedAt,
      },
      { ...input, now: timestamp },
    );

    await this.repositories.assignments.save(updated);
    await this.dependencies.activityLogs.record({
      ...input,
      now: timestamp,
      workOrderId: assignment.workOrderId,
      action: "assignment.status_changed",
      eventType: "assignment_status_changed",
      message: `Changed assignment status from ${assignment.status} to ${input.status}.`,
      entityType: "assignment",
      entityId: assignment.id,
      entityLabel: assignment.contractorSnapshot.name,
      visibility: "internal",
      changes: [
        { field: "status", from: assignment.status, to: input.status },
      ],
      metadata: {
        fromStatus: assignment.status,
        toStatus: input.status,
      },
    });
    logger.info("use_case.completed", {
      action: "assignment.status_changed",
      resource: {
        type: "assignment",
        id: assignment.id,
        label: assignment.contractorSnapshot.name,
      },
      fromStatus: assignment.status,
      toStatus: input.status,
    });

    return serviceOk(updated);
  }
}

function canAssignmentTransition(
  from: AssignmentStatus,
  to: AssignmentStatus,
): boolean {
  const transitions = {
    pending: ["accepted", "declined", "cancelled"],
    accepted: ["completed", "cancelled"],
    declined: [],
    cancelled: [],
    completed: [],
  } as const satisfies Record<AssignmentStatus, readonly AssignmentStatus[]>;

  return (transitions[from] as readonly AssignmentStatus[]).includes(to);
}
