import "server-only";

import type {
  FirestoreRepositories,
  Location,
  WorkOrder,
} from "@/server/repositories";
import {
  canAddWorkOrderNote,
  canCreateWorkOrder,
  canEditWorkOrder,
  canUpdateWorkOrderStatus,
  isWorkOrderInActorScope,
  type WorkOrderPermissionTarget,
} from "@/server/authorization/work-order.permissions";
import type { EntityId, IsoDateTimeString } from "@/types/entity";
import { USER_ROLES } from "@/types/permissions";
import type { WorkOrderPriority, WorkOrderStatus } from "@/types/work-order";
import {
  conflictError,
  invalidTransitionError,
  notFoundError,
  validationError,
} from "./errors.ts";
import {
  canWorkOrderTransition,
  isTerminalWorkOrderStatus,
} from "./status-rules.ts";
import type { DomainEventService } from "./domain-event-service.ts";
import type { NotificationService } from "./notification-service.ts";
import type { ClientLocationService } from "./client-location-service.ts";
import { createServiceLogger } from "./observability.ts";
import {
  createAuditFields,
  serviceFail,
  serviceOk,
  touchAuditFields,
  type ServiceResult,
} from "./types.ts";
import {
  isSystemWorkOrderMutationActor,
  type WorkOrderMutationActor,
  type WorkOrderMutationContext,
  type WorkOrderMutationSource,
} from "./work-order-mutation-context.ts";
import { isAlreadyExistsError } from "@/lib/idempotency/already-exists";
import type { AtomicPersistenceService } from "./atomic-persistence-service";


export interface WorkOrderService {
  list(input: ListWorkOrdersServiceInput): Promise<ServiceResult<WorkOrder[]>>;
  getById(workOrderId: EntityId): Promise<ServiceResult<WorkOrder>>;
  create(input: CreateWorkOrderServiceInput): Promise<ServiceResult<WorkOrder>>;
  update(input: UpdateWorkOrderServiceInput): Promise<ServiceResult<WorkOrder>>;
  assignInternalStaff(
    input: AssignInternalStaffInput,
  ): Promise<ServiceResult<WorkOrder>>;
  assignContractor(
    input: AssignContractorToWorkOrderInput,
  ): Promise<ServiceResult<WorkOrder>>;
  applyContractorAssignment(
    input: ApplyContractorAssignmentInput,
  ): Promise<ServiceResult<WorkOrder>>;
  applyQuoteWorkflowPointer(
    input: ApplyQuoteWorkflowPointerInput,
  ): Promise<ServiceResult<WorkOrder>>;
  applyQuoteWorkflowTransition(
    input: ApplyQuoteWorkflowTransitionInput,
  ): Promise<ServiceResult<WorkOrder>>;
  applyInvoiceWorkflowPointer(
    input: ApplyInvoiceWorkflowPointerInput,
  ): Promise<ServiceResult<WorkOrder>>;
  applyInvoiceWorkflowTransition(
    input: ApplyInvoiceWorkflowTransitionInput,
  ): Promise<ServiceResult<WorkOrder>>;
  addNote(input: AddWorkOrderNoteInput): Promise<ServiceResult<WorkOrder>>;
  transition(input: TransitionWorkOrderInput): Promise<ServiceResult<WorkOrder>>;
}

export type ListWorkOrdersServiceInput =
  | {
      scope: "organization";
      organizationId: EntityId;
      limit?: number;
    }
  | {
      scope: "clientOrganization";
      clientOrganizationId: EntityId;
      limit?: number;
    }
  | {
      scope: "locations";
      locationIds: EntityId[];
      limit?: number;
    }
  | {
      scope: "contractorOrganization";
      contractorOrganizationId: EntityId;
      limit?: number;
    };

export interface CreateWorkOrderServiceInput extends WorkOrderMutationContext {
  requestedWorkOrderId?: EntityId;
  title: string;
  description: string;
  priority: WorkOrderPriority;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  requestedByContactId?: EntityId | null;
  siteContactId?: EntityId | null;
  requestedByName?: string | null;
  requestedByEmail?: string | null;
  requestedByPhone?: string | null;
  coordinatorUserId?: EntityId | null;
  managerUserId?: EntityId | null;
  category?: string | null;
  requestedServiceDate?: IsoDateTimeString | null;
  dueDate?: IsoDateTimeString | null;
  requiresQuote?: boolean;
  quoteRequiredThresholdCents?: number | null;
}

export interface UpdateWorkOrderServiceInput extends WorkOrderMutationContext {
  workOrderId: EntityId;
  title?: string;
  description?: string;
  priority?: WorkOrderPriority;
  clientOrganizationId?: EntityId;
  locationId?: EntityId;
  coordinatorUserId?: EntityId | null;
  managerUserId?: EntityId | null;
  category?: string | null;
  requestedServiceDate?: IsoDateTimeString | null;
}

export interface AssignInternalStaffInput extends WorkOrderMutationContext {
  workOrderId: EntityId;
  coordinatorUserId?: EntityId | null;
  managerUserId?: EntityId | null;
}

export interface AssignContractorToWorkOrderInput extends WorkOrderMutationContext {
  workOrderId: EntityId;
  contractorOrganizationId: EntityId | null;
}

export interface ApplyContractorAssignmentInput extends WorkOrderMutationContext {
  workOrderId: EntityId;
  contractorOrganizationId: EntityId;
  assignedAt?: IsoDateTimeString;
}

export interface ApplyQuoteWorkflowPointerInput extends WorkOrderMutationContext {
  workOrderId: EntityId;
  currentQuoteId: EntityId | null;
}

export interface ApplyQuoteWorkflowTransitionInput extends WorkOrderMutationContext {
  workOrderId: EntityId;
  toStatus: WorkOrderStatus;
  activityMessage?: string;
}

export interface ApplyInvoiceWorkflowPointerInput extends WorkOrderMutationContext {
  workOrderId: EntityId;
  currentInvoiceId: EntityId | null;
}

export interface ApplyInvoiceWorkflowTransitionInput
  extends WorkOrderMutationContext {
  workOrderId: EntityId;
  toStatus: WorkOrderStatus;
  activityMessage?: string;
  currentInvoiceId?: EntityId | null;
  invoiceSentAt?: IsoDateTimeString | null;
  paidAt?: IsoDateTimeString | null;
  invoiceId?: EntityId;
  invoiceNumber?: string;
}

export interface AddWorkOrderNoteInput extends WorkOrderMutationContext {
  workOrderId: EntityId;
  note: string;
  noteType: "internal" | "operational";
}

export interface TransitionWorkOrderInput extends WorkOrderMutationContext {
  workOrderId: EntityId;
  toStatus: WorkOrderStatus;
  completionAccepted?: boolean;
  activityMessage?: string;
}

export function createWorkOrderService(
  repositories: Pick<
    FirestoreRepositories,
    "workOrders" | "clientQuotes" | "clientInvoices" | "clientOrganizations" | "locations"
    | "contractorOrganizations"
  >,
  dependencies: {
    domainEvents: DomainEventService;
    clientLocations: ClientLocationService;
    notifications?: NotificationService;
    atomicPersistence?: AtomicPersistenceService;
  },
): WorkOrderService {
  return new FirestoreWorkOrderService(repositories, dependencies);
}

class FirestoreWorkOrderService implements WorkOrderService {
  private readonly repositories: Pick<
    FirestoreRepositories,
    "workOrders" | "clientQuotes" | "clientInvoices" | "clientOrganizations" | "locations"
    | "contractorOrganizations"
  >;

  private readonly dependencies: {
    domainEvents: DomainEventService;
    clientLocations: ClientLocationService;
    notifications?: NotificationService;
    atomicPersistence?: AtomicPersistenceService;
  };

  constructor(
    repositories: Pick<
      FirestoreRepositories,
      "workOrders" | "clientQuotes" | "clientInvoices" | "clientOrganizations" | "locations"
      | "contractorOrganizations"
    >,
    dependencies: {
      domainEvents: DomainEventService;
      clientLocations: ClientLocationService;
      notifications?: NotificationService;
      atomicPersistence?: AtomicPersistenceService;
    },
  ) {
    this.repositories = repositories;
    this.dependencies = dependencies;
  }

  async list(
    input: ListWorkOrdersServiceInput,
  ): Promise<ServiceResult<WorkOrder[]>> {
    if (input.scope === "organization") {
      const result = await this.repositories.workOrders.listByOrganizationId(
        input.organizationId,
        { limit: input.limit },
      );
      return serviceOk(result.items);
    }

    if (input.scope === "clientOrganization") {
      const result =
        await this.repositories.workOrders.listByClientOrganizationId(
          input.clientOrganizationId,
          { limit: input.limit },
        );
      return serviceOk(result.items);
    }

    if (input.scope === "contractorOrganization") {
      const result =
        await this.repositories.workOrders.listByContractorOrganizationId(
          input.contractorOrganizationId,
          { limit: input.limit },
        );
      return serviceOk(result.items);
    }

    const workOrders = await Promise.all(
      input.locationIds.map(async (locationId) => {
        const result = await this.repositories.workOrders.listByLocationId(
          locationId,
          { limit: input.limit },
        );
        return result.items;
      }),
    );
    const deduped = new Map(workOrders.flat().map((workOrder) => [
      workOrder.id,
      workOrder,
    ]));
    return serviceOk(
      [...deduped.values()]
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, input.limit),
    );
  }

  async getById(workOrderId: EntityId): Promise<ServiceResult<WorkOrder>> {
    const workOrder = await this.repositories.workOrders.getById(workOrderId);
    if (!workOrder || workOrder.isDeleted) {
      return serviceFail(notFoundError("Work order could not be found."));
    }

    return serviceOk(workOrder);
  }

  async create(
    input: CreateWorkOrderServiceInput,
  ): Promise<ServiceResult<WorkOrder>> {
    const actorContext = this.validateMutationContext(input, [
      "work_order_api",
      "intake_review",
    ]);
    if (!actorContext.ok) {
      return actorContext;
    }
    const logger = createServiceLogger("work_order.create", input);

    const createAuthorization = this.authorizeCreate(input);
    if (!createAuthorization.ok) {
      return createAuthorization;
    }

    const requiredFields = validateRequiredTextFields({
      title: input.title,
      description: input.description,
      clientOrganizationId: input.clientOrganizationId,
      locationId: input.locationId,
    });
    if (requiredFields) {
      return serviceFail(requiredFields);
    }

    const clientLocation = await this.dependencies.clientLocations
      .getClientLocationContext({
        organizationId: input.organizationId,
        clientOrganizationId: input.clientOrganizationId,
        locationId: input.locationId,
      });
    if (!clientLocation.ok) {
      return clientLocation;
    }

    const id = input.requestedWorkOrderId?.trim() || this.repositories.workOrders.newId();
    const requiresQuote = input.requiresQuote ?? false;
    const workOrder: WorkOrder = {
      id,
      ...createAuditFields(input),
      workOrderNumber: `WO-${id.slice(0, 8).toUpperCase()}`,
      title: input.title.trim(),
      description: input.description.trim(),
      poNumber: null,
      requestedByName: input.requestedByName?.trim() || null,
      requestedByEmail: input.requestedByEmail?.trim() || null,
      requestedByPhone: input.requestedByPhone?.trim() || null,
      requestedServiceDate: input.requestedServiceDate ?? null,
      dueDate: input.dueDate ?? null,
      category: input.category ?? null,
      requiresQuote,
      quoteRequiredThresholdCents:
        requiresQuote ? input.quoteRequiredThresholdCents ?? null : null,
      lifecycleStatus: input.requestedServiceDate ? "triage" : "new",
      status: input.requestedServiceDate ? "triage" : "new",
      assignmentStatus: null,
      quoteSummaryStatus: requiresQuote ? "required" : "not_required",
      invoiceSummaryStatus: "not_ready",
      approvalStatus: "not_required",
      priority: input.priority,
      clientOrganizationId: input.clientOrganizationId,
      locationId: input.locationId,
      requestedByContactId: input.requestedByContactId ?? null,
      siteContactId: input.siteContactId ?? null,
      coordinatorUserId: input.coordinatorUserId ?? null,
      managerUserId: input.managerUserId ?? null,
      assignedCoordinatorUserId: null,
      assignedManagerUserId: null,
      assignedContractorOrgId: null,
      assignedContractorId: null,
      assignedContractorContactId: null,
      financeOwnerUserId: null,
      quoteReviewerUserId: null,
      currentQuoteId: null,
      currentInvoiceId: null,
      currentQuoteVersionNumber: null,
      invoiceNumber: null,
      clientSnapshot: {
        id: clientLocation.value.client.id,
        name: clientLocation.value.client.displayName ?? clientLocation.value.client.name,
      },
      locationSnapshot: buildLocationSnapshot(clientLocation.value.location),
      contractorSnapshot: null,
      lastActivityAt: input.now ?? new Date().toISOString(),
      nextActionOwnerType: null,
      nextActionDueAt: null,
      isEscalated: false,
      escalationReason: null,
      holdReason: null,
      previousLifecycleStatus: null,
      intakeReceivedAt: input.now ?? new Date().toISOString(),
      triagedAt: null,
      assignedAt: null,
      contractorContactedAt: null,
      contractorRespondedAt: null,
      contractorScheduledAt: null,
      workStartedAt: null,
      quoteRequestedAt: null,
      contractorQuoteReceivedAt: null,
      quoteReviewStartedAt: null,
      clientApprovalRequestedAt: null,
      clientApprovedAt: null,
      workCompletedAt: null,
      completionReviewStartedAt: null,
      readyForInvoicingAt: null,
      invoiceSentAt: null,
      paidAt: null,
      closedAt: null,
      cancelledAt: null,
      holdStartedAt: null,
      escalatedAt: null,
    };

    const recordCreatedEvent = async (atomic?: WorkOrderMutationContext["atomic"]) => {
      await this.dependencies.domainEvents.record({
        ...input,
        atomic,
        workOrderId: workOrder.id,
        type: "work_order_created",
        visibility: "internal",
        lifecycleStatus: workOrder.lifecycleStatus,
        entity: {
          entityType: "work_order",
          entityId: workOrder.id,
          label: workOrder.workOrderNumber,
        },
        summary: `Created ${workOrder.workOrderNumber}.`,
        payload: {
          lifecycleStatus: workOrder.lifecycleStatus,
          priority: workOrder.priority,
          title: workOrder.title,
        },
      });
    };

    try {
      if (input.atomic) {
        input.atomic.create("workOrders", workOrder);
      } else if (this.dependencies.atomicPersistence) {
        await this.dependencies.atomicPersistence.runInTransaction(async (atomic) => {
          atomic.create("workOrders", workOrder);
          await recordCreatedEvent(atomic);
        });
      } else {
        await this.repositories.workOrders.create(workOrder);
      }
    } catch (error) {
      if (!isAlreadyExistsError(error) || !input.requestedWorkOrderId) {
        throw error;
      }

      const existing = await this.repositories.workOrders.getById(id);
      if (!existing) {
        throw error;
      }
      return serviceOk(existing);
    }
    if (input.atomic) {
      await recordCreatedEvent(input.atomic);
    } else if (!this.dependencies.atomicPersistence) {
      await recordCreatedEvent();
    }
    logger.info("use_case.completed", {
      action: "work_order.created",
      resource: {
        type: "workOrder",
        id: workOrder.id,
        label: workOrder.workOrderNumber,
      },
      lifecycleStatus: workOrder.lifecycleStatus,
    });

    return serviceOk(workOrder);
  }

  async update(
    input: UpdateWorkOrderServiceInput,
  ): Promise<ServiceResult<WorkOrder>> {
    const actorContext = this.validateMutationContext(input, "work_order_api");
    if (!actorContext.ok) {
      return actorContext;
    }
    const logger = createServiceLogger("work_order.update", input);

    const existing = await this.getById(input.workOrderId);
    if (!existing.ok) {
      return existing;
    }

    const authorization = this.authorizeEdit(existing.value, input);
    if (!authorization.ok) {
      return authorization;
    }

    if (isTerminalWorkOrderStatus(existing.value.lifecycleStatus)) {
      return serviceFail(
        conflictError("Terminal work orders cannot be edited."),
      );
    }

    const nextClientOrganizationId =
      input.clientOrganizationId ?? existing.value.clientOrganizationId;
    const nextLocationId = input.locationId ?? existing.value.locationId;
    const clientLocation = await this.dependencies.clientLocations
      .getClientLocationContext({
        organizationId: input.organizationId,
        clientOrganizationId: nextClientOrganizationId,
        locationId: nextLocationId,
      });
    if (!clientLocation.ok) {
      return clientLocation;
    }

    const updated = touchAuditFields(
      {
        ...existing.value,
        title: input.title?.trim() ?? existing.value.title,
        description: input.description?.trim() ?? existing.value.description,
        priority: input.priority ?? existing.value.priority,
        clientOrganizationId: nextClientOrganizationId,
        locationId: nextLocationId,
        coordinatorUserId:
          input.coordinatorUserId ?? existing.value.coordinatorUserId,
        managerUserId:
          input.managerUserId ?? existing.value.managerUserId,
        category: input.category ?? existing.value.category,
        requestedServiceDate:
          input.requestedServiceDate ?? existing.value.requestedServiceDate,
        clientSnapshot: {
          id: clientLocation.value.client.id,
          name:
            clientLocation.value.client.displayName ??
            clientLocation.value.client.name,
        },
        locationSnapshot: buildLocationSnapshot(clientLocation.value.location),
      },
      input,
    );

    if (!updated.title || !updated.description) {
      return serviceFail(
        validationError("Work order title and description are required."),
      );
    }

    if (input.atomic) {
      input.atomic.save("workOrders", updated);
    } else {
      await this.repositories.workOrders.save(updated);
    }
    logger.info("use_case.completed", {
      action: "work_order.updated",
      resource: {
        type: "workOrder",
        id: updated.id,
        label: updated.workOrderNumber,
      },
    });

    return serviceOk(updated);
  }

  async assignInternalStaff(
    input: AssignInternalStaffInput,
  ): Promise<ServiceResult<WorkOrder>> {
    const actorContext = this.validateMutationContext(input, "work_order_api");
    if (!actorContext.ok) {
      return actorContext;
    }
    const logger = createServiceLogger("work_order.assign_internal_staff", input);

    const existing = await this.getById(input.workOrderId);
    if (!existing.ok) {
      return existing;
    }

    const authorization = this.authorizeInternalAssignment(existing.value, input);
    if (!authorization.ok) {
      return authorization;
    }

    if (isTerminalWorkOrderStatus(existing.value.lifecycleStatus)) {
      return serviceFail(
        conflictError("Terminal work orders cannot be reassigned."),
      );
    }

    const updated = touchAuditFields(
      {
        ...existing.value,
        coordinatorUserId:
          "coordinatorUserId" in input
            ? input.coordinatorUserId ?? null
            : existing.value.coordinatorUserId,
        managerUserId:
          "managerUserId" in input
            ? input.managerUserId ?? null
            : existing.value.managerUserId,
      },
      input,
    );

    if (input.atomic) {
      input.atomic.save("workOrders", updated);
    } else {
      await this.repositories.workOrders.save(updated);
    }
    logger.info("use_case.completed", {
      action: "work_order.assigned",
      resource: {
        type: "workOrder",
        id: updated.id,
        label: updated.workOrderNumber,
      },
    });

    return serviceOk(updated);
  }

  async assignContractor(
    input: AssignContractorToWorkOrderInput,
  ): Promise<ServiceResult<WorkOrder>> {
    const actorContext = this.validateMutationContext(input, "work_order_api");
    if (!actorContext.ok) {
      return actorContext;
    }
    const logger = createServiceLogger("work_order.assign_contractor", input);

    const existing = await this.getById(input.workOrderId);
    if (!existing.ok) {
      return existing;
    }

    const authorization = this.authorizeContractorAssignment(existing.value, input);
    if (!authorization.ok) {
      return authorization;
    }

    if (isTerminalWorkOrderStatus(existing.value.lifecycleStatus)) {
      return serviceFail(
        conflictError("Terminal work orders cannot be assigned to contractors."),
      );
    }

    const contractor = input.contractorOrganizationId
      ? await this.repositories.contractorOrganizations.getById(
          input.contractorOrganizationId,
        )
      : null;
    if (
      input.contractorOrganizationId &&
      (!contractor || contractor.isDeleted || contractor.status !== "active")
    ) {
      return serviceFail(
        notFoundError("Active contractor organization could not be found."),
      );
    }

    const updated = touchAuditFields(
      {
        ...existing.value,
        assignedContractorOrgId: contractor?.id ?? null,
        contractorSnapshot: contractor
          ? {
              id: contractor.id,
              name: contractor.displayName ?? contractor.name,
            }
          : null,
        lifecycleStatus:
          contractor && existing.value.lifecycleStatus === "client_approved"
            ? "assigned"
            : existing.value.lifecycleStatus,
        assignedAt: contractor
          ? (input.now ?? new Date().toISOString())
          : existing.value.assignedAt,
      },
      input,
    );

    if (input.atomic) {
      input.atomic.save("workOrders", updated);
    } else {
      await this.repositories.workOrders.save(updated);
    }
    logger.info("use_case.completed", {
      action: contractor ? "work_order.assigned" : "work_order.updated",
      resource: {
        type: "workOrder",
        id: updated.id,
        label: updated.workOrderNumber,
      },
    });

    return serviceOk(updated);
  }

  async applyContractorAssignment(
    input: ApplyContractorAssignmentInput,
  ): Promise<ServiceResult<WorkOrder>> {
    const actorContext = this.validateMutationContext(input, "assignment_workflow");
    if (!actorContext.ok) {
      return actorContext;
    }

    const existing = await this.getById(input.workOrderId);
    if (!existing.ok) {
      return existing;
    }

    const authorization = this.authorizeWorkflowMutation(
      existing.value,
      input,
      "assignment_workflow",
    );
    if (!authorization.ok) {
      return authorization;
    }

    if (isTerminalWorkOrderStatus(existing.value.lifecycleStatus)) {
      return serviceFail(
        conflictError("Terminal work orders cannot be assigned to contractors."),
      );
    }

    const scopedWorkOrder = this.normalizeScopedWorkOrder(existing.value, input);
    if (!scopedWorkOrder.ok) {
      return scopedWorkOrder;
    }

    const contractor = await this.repositories.contractorOrganizations.getById(
      input.contractorOrganizationId,
    );
    if (!contractor || contractor.isDeleted || contractor.status !== "active") {
      return serviceFail(
        notFoundError("Active contractor organization could not be found."),
      );
    }

    const timestamp = input.assignedAt ?? input.now ?? new Date().toISOString();
    const didAdvanceLifecycle =
      scopedWorkOrder.value.lifecycleStatus === "client_approved";
    const updated = touchAuditFields(
      {
        ...scopedWorkOrder.value,
        assignedContractorOrgId: contractor.id,
        contractorSnapshot: {
          id: contractor.id,
          name: contractor.displayName ?? contractor.name,
        },
        assignedAt: timestamp,
        lifecycleStatus: didAdvanceLifecycle
          ? "assigned"
          : scopedWorkOrder.value.lifecycleStatus,
        lastActivityAt: didAdvanceLifecycle
          ? timestamp
          : scopedWorkOrder.value.lastActivityAt,
      },
      { ...input, now: timestamp },
    );

    if (input.atomic) {
      input.atomic.save("workOrders", updated);
    } else {
      await this.repositories.workOrders.save(updated);
    }
    return serviceOk(updated);
  }

  async applyQuoteWorkflowPointer(
    input: ApplyQuoteWorkflowPointerInput,
  ): Promise<ServiceResult<WorkOrder>> {
    const actorContext = this.validateMutationContext(input, "quote_workflow");
    if (!actorContext.ok) {
      return actorContext;
    }

    const existing = await this.getById(input.workOrderId);
    if (!existing.ok) {
      return existing;
    }

    const authorization = this.authorizeWorkflowMutation(
      existing.value,
      input,
      "quote_workflow",
    );
    if (!authorization.ok) {
      return authorization;
    }

    const scopedWorkOrder = this.normalizeScopedWorkOrder(existing.value, input);
    if (!scopedWorkOrder.ok) {
      return scopedWorkOrder;
    }

    if (scopedWorkOrder.value.currentQuoteId === input.currentQuoteId) {
      return serviceOk(scopedWorkOrder.value);
    }

    const updated = touchAuditFields(
      {
        ...scopedWorkOrder.value,
        currentQuoteId: input.currentQuoteId,
      },
      input,
    );

    if (input.atomic) {
      input.atomic.save("workOrders", updated);
    } else {
      await this.repositories.workOrders.save(updated);
    }
    return serviceOk(updated);
  }

  async applyQuoteWorkflowTransition(
    input: ApplyQuoteWorkflowTransitionInput,
  ): Promise<ServiceResult<WorkOrder>> {
    const actorContext = this.validateMutationContext(input, "quote_workflow");
    if (!actorContext.ok) {
      return actorContext;
    }

    const existing = await this.getById(input.workOrderId);
    if (!existing.ok) {
      return existing;
    }

    const authorization = this.authorizeQuoteWorkflowTransition(
      existing.value,
      input,
    );
    if (!authorization.ok) {
      return authorization;
    }

    if (existing.value.lifecycleStatus === input.toStatus) {
      return existing;
    }

    return this.applyTransition(existing.value, input, {
      emitCanonicalLifecycleEvent: false,
      emitReadyForInvoicingNotification: false,
      transitionMetadata: {
        source: "quote_workflow",
      },
    });
  }

  async applyInvoiceWorkflowPointer(
    input: ApplyInvoiceWorkflowPointerInput,
  ): Promise<ServiceResult<WorkOrder>> {
    const actorContext = this.validateMutationContext(input, "invoice_workflow");
    if (!actorContext.ok) {
      return actorContext;
    }

    const existing = await this.getById(input.workOrderId);
    if (!existing.ok) {
      return existing;
    }

    const authorization = this.authorizeWorkflowMutation(
      existing.value,
      input,
      "invoice_workflow",
    );
    if (!authorization.ok) {
      return authorization;
    }

    const scopedWorkOrder = this.normalizeScopedWorkOrder(existing.value, input);
    if (!scopedWorkOrder.ok) {
      return scopedWorkOrder;
    }

    if (scopedWorkOrder.value.currentInvoiceId === input.currentInvoiceId) {
      return serviceOk(scopedWorkOrder.value);
    }

    const updated = touchAuditFields(
      {
        ...scopedWorkOrder.value,
        currentInvoiceId: input.currentInvoiceId,
      },
      input,
    );

    if (input.atomic) {
      input.atomic.save("workOrders", updated);
    } else {
      await this.repositories.workOrders.save(updated);
    }
    return serviceOk(updated);
  }

  async applyInvoiceWorkflowTransition(
    input: ApplyInvoiceWorkflowTransitionInput,
  ): Promise<ServiceResult<WorkOrder>> {
    const actorContext = this.validateMutationContext(input, "invoice_workflow");
    if (!actorContext.ok) {
      return actorContext;
    }

    const existing = await this.getById(input.workOrderId);
    if (!existing.ok) {
      return existing;
    }

    const authorization = this.authorizeInvoiceWorkflowTransition(
      existing.value,
      input,
    );
    if (!authorization.ok) {
      return authorization;
    }

    if (existing.value.lifecycleStatus === input.toStatus) {
      const scopedWorkOrder = this.normalizeScopedWorkOrder(existing.value, input);
      if (!scopedWorkOrder.ok) {
        return scopedWorkOrder;
      }

      if (!("currentInvoiceId" in input)) {
        return scopedWorkOrder;
      }

      const updated = touchAuditFields(
        {
          ...scopedWorkOrder.value,
          currentInvoiceId: input.currentInvoiceId ?? null,
        },
        input,
      );
      if (input.atomic) {
        input.atomic.save("workOrders", updated);
      } else {
        await this.repositories.workOrders.save(updated);
      }
      return serviceOk(updated);
    }

    return this.applyTransition(existing.value, input, {
      allowInvoiceReopen:
        existing.value.lifecycleStatus === "invoiced" &&
        input.toStatus === "ready_for_invoicing",
      emitCanonicalLifecycleEvent: false,
      emitReadyForInvoicingNotification: false,
      transitionMetadata: {
        source: "invoice_workflow",
        invoiceId: input.invoiceId,
        invoiceNumber: input.invoiceNumber,
      },
      mutateBeforeSave: (workOrder, timestamp) => ({
        ...workOrder,
        currentInvoiceId:
          "currentInvoiceId" in input
            ? input.currentInvoiceId ?? null
            : workOrder.currentInvoiceId,
        invoiceSentAt:
          input.toStatus === "invoiced"
            ? input.invoiceSentAt ?? workOrder.invoiceSentAt ?? timestamp
            : workOrder.invoiceSentAt,
        paidAt:
          input.toStatus === "paid"
            ? input.paidAt ?? workOrder.paidAt ?? timestamp
            : workOrder.paidAt,
      }),
    });
  }

  async addNote(input: AddWorkOrderNoteInput): Promise<ServiceResult<WorkOrder>> {
    const actorContext = this.validateMutationContext(input, "work_order_api");
    if (!actorContext.ok) {
      return actorContext;
    }
    const logger = createServiceLogger("work_order.add_note", input);

    const existing = await this.getById(input.workOrderId);
    if (!existing.ok) {
      return existing;
    }

    const authorization = this.authorizeNote(existing.value, input);
    if (!authorization.ok) {
      return authorization;
    }

    const note = input.note.trim();
    if (!note) {
      return serviceFail(validationError("Note is required."));
    }

    const updated = touchAuditFields(existing.value, input);
    if (input.atomic) {
      input.atomic.save("workOrders", updated);
    } else {
      await this.repositories.workOrders.save(updated);
    }
    logger.info("use_case.completed", {
      action: "work_order.updated",
      resource: {
        type: "workOrder",
        id: updated.id,
        label: updated.workOrderNumber,
      },
      noteType: input.noteType,
    });

    return serviceOk(updated);
  }

  async transition(
    input: TransitionWorkOrderInput,
  ): Promise<ServiceResult<WorkOrder>> {
    const actorContext = this.validateMutationContext(input, "work_order_api");
    if (!actorContext.ok) {
      return actorContext;
    }
    const logger = createServiceLogger("work_order.transition", input);

    const existing = await this.getById(input.workOrderId);
    if (!existing.ok) {
      return existing;
    }

    const authorization = this.authorizeDirectTransition(existing.value, input);
    if (!authorization.ok) {
      return authorization;
    }

    const transitioned = await this.applyTransition(existing.value, input);
    if (!transitioned.ok) {
      return transitioned;
    }
    logger.info("use_case.completed", {
      action: "work_order.status_changed",
      resource: {
        type: "workOrder",
        id: transitioned.value.id,
        label: transitioned.value.workOrderNumber,
      },
      fromLifecycleStatus: existing.value.lifecycleStatus,
      toLifecycleStatus: input.toStatus,
    });

    return transitioned;
  }

  private async validateTransition(
    workOrder: WorkOrder,
    input: TransitionWorkOrderInput,
    options: {
      allowInvoiceReopen?: boolean;
    } = {},
  ): Promise<ServiceResult<true>> {
    if (isTerminalWorkOrderStatus(workOrder.lifecycleStatus)) {
      return serviceFail(
        invalidTransitionError(
          `Work order lifecycle ${workOrder.lifecycleStatus} is terminal.`,
        ),
      );
    }

    if (!canWorkOrderTransition(workOrder.lifecycleStatus, input.toStatus, {
      previousLifecycleStatus: workOrder.previousLifecycleStatus,
      holdReason: workOrder.holdReason,
      escalationReason: workOrder.escalationReason,
      allowInvoiceReopen: options.allowInvoiceReopen,
    })) {
      return serviceFail(
        invalidTransitionError(
          `Work order cannot transition from ${workOrder.lifecycleStatus} to ${input.toStatus}.`,
        ),
      );
    }

    const quoteValidation = await this.validateQuotePrerequisites(
      workOrder,
      input.toStatus,
    );
    if (!quoteValidation.ok) {
      return quoteValidation;
    }

    if (input.toStatus === "work_completed" && !input.completionAccepted) {
      return serviceFail(
        validationError("Completion must be accepted before the work order is completed."),
      );
    }

    if (input.toStatus === "invoiced") {
      const invoices = await this.repositories.clientInvoices.listByWorkOrderId(
        workOrder.id,
      );
      const activeInvoice = invoices.items.find(
        (invoice) => invoice.status !== "void",
      );
      if (!activeInvoice || workOrder.currentInvoiceId !== activeInvoice.id) {
        return serviceFail(
          validationError("A current non-void invoice is required before invoicing."),
        );
      }
    }

    if (input.toStatus === "closed") {
      const invoices = await this.repositories.clientInvoices.listByWorkOrderId(
        workOrder.id,
      );
      const currentInvoice = invoices.items.find(
        (invoice) => invoice.id === workOrder.currentInvoiceId,
      );
      if (workOrder.lifecycleStatus === "paid" && currentInvoice?.status !== "paid") {
        return serviceFail(
          validationError("The current invoice must be paid before closing."),
        );
      }
    }

    return serviceOk(true);
  }

  private async validateQuotePrerequisites(
    workOrder: WorkOrder,
    toStatus: WorkOrderStatus,
  ): Promise<ServiceResult<true>> {
    const quoteGatedStatuses = new Set<WorkOrderStatus>([
      "assigned",
      "contractor_scheduled",
      "in_progress",
    ]);

    if (!quoteGatedStatuses.has(toStatus)) {
      return serviceOk(true);
    }

    const isQuotePath =
      workOrder.currentQuoteId != null ||
      workOrder.lifecycleStatus === "quote_required" ||
      workOrder.lifecycleStatus === "contractor_quote_received" ||
      workOrder.lifecycleStatus === "quote_under_review" ||
      workOrder.lifecycleStatus === "client_approval_requested";

    if (!isQuotePath) {
      return serviceOk(true);
    }

    if (!workOrder.currentQuoteId) {
      return serviceFail(
        validationError(
          "A current quote is required before the quote-required path can proceed.",
        ),
      );
    }

    const quote = await this.repositories.clientQuotes.getById(workOrder.currentQuoteId);
    if (
      !quote ||
      quote.isDeleted ||
      quote.workOrderId !== workOrder.id ||
      quote.status !== "approved"
    ) {
      return serviceFail(
        validationError(
          "A client-approved current quote is required before proceeding.",
        ),
      );
    }

    return serviceOk(true);
  }

  private validateMutationContext(
    input: WorkOrderMutationContext,
    expectedSource: WorkOrderMutationSource | readonly WorkOrderMutationSource[],
  ): ServiceResult<true> {
    if (!input.actor || !input.source) {
      return serviceFail(validationError("Explicit work-order actor context is required."));
    }

    const allowedSources = Array.isArray(expectedSource)
      ? expectedSource
      : [expectedSource];
    if (!allowedSources.includes(input.source)) {
      return serviceFail(
        validationError(
          `Work-order mutation source must be one of: ${allowedSources.join(", ")}.`,
        ),
      );
    }

    if (input.actor.userId !== "system" && input.actor.userId.trim().length === 0) {
      return serviceFail(validationError("Work-order actor id is required."));
    }

    const actorOrganizationId = input.actor.scope.organizationId;
    if (!actorOrganizationId || actorOrganizationId !== input.organizationId) {
      return serviceFail(notFoundError("Work order could not be found."));
    }

    if (isSystemWorkOrderMutationActor(input.actor)) {
      if (input.actor.scope.kind !== "system" || input.actor.scope.trusted !== true) {
        return serviceFail(validationError("System work-order mutations require a trusted system actor."));
      }

      return serviceOk(true);
    }

    if (input.actor.scope.organizationId !== input.organizationId) {
      return serviceFail(notFoundError("Work order could not be found."));
    }

    return serviceOk(true);
  }

  private authorizeCreate(
    input: CreateWorkOrderServiceInput,
  ): ServiceResult<true> {
    if (isSystemWorkOrderMutationActor(input.actor)) {
      return serviceFail(validationError("System actors cannot create work orders directly."));
    }

    const allowed = canCreateWorkOrder(input.actor, {
      organizationId: input.organizationId,
      clientOrganizationId: input.clientOrganizationId,
      locationId: input.locationId,
    });
    if (!allowed) {
      return serviceFail(validationError("You do not have permission to create this work order."));
    }

    return serviceOk(true);
  }

  private authorizeEdit(
    workOrder: WorkOrder,
    input: UpdateWorkOrderServiceInput,
  ): ServiceResult<true> {
    if (isSystemWorkOrderMutationActor(input.actor)) {
      return serviceFail(validationError("System actors cannot edit work orders directly."));
    }

    if (!canEditWorkOrder(input.actor, this.toPermissionTarget(workOrder))) {
      return serviceFail(validationError("You do not have permission to edit this work order."));
    }

    return serviceOk(true);
  }

  private authorizeInternalAssignment(
    workOrder: WorkOrder,
    input: AssignInternalStaffInput,
  ): ServiceResult<true> {
    if (isSystemWorkOrderMutationActor(input.actor)) {
      return serviceFail(validationError("System actors cannot assign internal staff directly."));
    }

    if (input.actor.actorType !== "internal") {
      return serviceFail(validationError("Only internal users may assign internal staff."));
    }

    if (!canEditWorkOrder(input.actor, this.toPermissionTarget(workOrder))) {
      return serviceFail(validationError("You do not have permission to assign internal staff."));
    }

    return serviceOk(true);
  }

  private authorizeContractorAssignment(
    workOrder: WorkOrder,
    input: AssignContractorToWorkOrderInput,
  ): ServiceResult<true> {
    if (isSystemWorkOrderMutationActor(input.actor)) {
      return serviceFail(validationError("System actors cannot assign contractors directly."));
    }

    if (input.actor.actorType !== "internal") {
      return serviceFail(validationError("Only internal users may assign contractors."));
    }

    if (!canUpdateWorkOrderStatus(input.actor, this.toPermissionTarget(workOrder), "assigned")) {
      return serviceFail(validationError("You do not have permission to assign a contractor."));
    }

    return serviceOk(true);
  }

  private authorizeNote(
    workOrder: WorkOrder,
    input: AddWorkOrderNoteInput,
  ): ServiceResult<true> {
    if (isSystemWorkOrderMutationActor(input.actor)) {
      return serviceFail(validationError("System actors cannot add work-order notes directly."));
    }

    if (!canAddWorkOrderNote(input.actor, this.toPermissionTarget(workOrder))) {
      return serviceFail(validationError("You do not have permission to add a note to this work order."));
    }

    return serviceOk(true);
  }

  private authorizeDirectTransition(
    workOrder: WorkOrder,
    input: TransitionWorkOrderInput,
  ): ServiceResult<true> {
    if (isSystemWorkOrderMutationActor(input.actor)) {
      return serviceFail(validationError("System actors cannot perform direct work-order transitions."));
    }

    if (!canUpdateWorkOrderStatus(input.actor, this.toPermissionTarget(workOrder), input.toStatus)) {
      return serviceFail(
        validationError(
          `You do not have permission to transition this work order to ${input.toStatus}.`,
        ),
      );
    }

    return serviceOk(true);
  }

  private authorizeWorkflowMutation(
    workOrder: WorkOrder,
    input: WorkOrderMutationContext,
    source: Extract<
      WorkOrderMutationSource,
      "assignment_workflow" | "quote_workflow" | "invoice_workflow"
    >,
  ): ServiceResult<true> {
    if (input.source !== source) {
      return serviceFail(validationError(`Work-order mutation source must be ${source}.`));
    }

    if (isSystemWorkOrderMutationActor(input.actor)) {
      return serviceFail(validationError("Workflow mutations require an explicit human actor."));
    }

    if (!isWorkOrderInActorScope(input.actor, this.toPermissionTarget(workOrder))) {
      return serviceFail(notFoundError("Work order could not be found."));
    }

    return serviceOk(true);
  }

  private authorizeQuoteWorkflowTransition(
    workOrder: WorkOrder,
    input: ApplyQuoteWorkflowTransitionInput,
  ): ServiceResult<true> {
    const workflowAuthorization = this.authorizeWorkflowMutation(
      workOrder,
      input,
      "quote_workflow",
    );
    if (!workflowAuthorization.ok) {
      return workflowAuthorization;
    }

    if (isSystemWorkOrderMutationActor(input.actor)) {
      return serviceFail(validationError("Workflow mutations require an explicit human actor."));
    }

    const { role } = input.actor;
    const allowed =
      (role === USER_ROLES.ContractorUser &&
        workOrder.lifecycleStatus === "quote_required" &&
        input.toStatus === "contractor_quote_received") ||
      ((role === USER_ROLES.Manager || role === USER_ROLES.Owner) &&
        (
          (workOrder.lifecycleStatus === "contractor_quote_received" &&
            input.toStatus === "quote_under_review") ||
          (workOrder.lifecycleStatus === "quote_under_review" &&
            input.toStatus === "client_approval_requested")
        )) ||
      (
        (role === USER_ROLES.ClientUser ||
          role === USER_ROLES.Manager ||
          role === USER_ROLES.Owner) &&
        workOrder.lifecycleStatus === "client_approval_requested" &&
        (input.toStatus === "client_approved" || input.toStatus === "quote_required")
      );

    if (!allowed) {
      return serviceFail(
        validationError(
          `Actor role ${role} may not drive quote workflow transition ${workOrder.lifecycleStatus} -> ${input.toStatus}.`,
        ),
      );
    }

    return serviceOk(true);
  }

  private authorizeInvoiceWorkflowTransition(
    workOrder: WorkOrder,
    input: ApplyInvoiceWorkflowTransitionInput,
  ): ServiceResult<true> {
    const workflowAuthorization = this.authorizeWorkflowMutation(
      workOrder,
      input,
      "invoice_workflow",
    );
    if (!workflowAuthorization.ok) {
      return workflowAuthorization;
    }

    if (isSystemWorkOrderMutationActor(input.actor)) {
      return serviceFail(validationError("Workflow mutations require an explicit human actor."));
    }

    const role = input.actor.role;
    const isFinanceActor =
      role === USER_ROLES.FinanceAdmin || role === USER_ROLES.Owner;

    const allowed =
      isFinanceActor &&
      (
        (
          (workOrder.lifecycleStatus === "work_completed" ||
            workOrder.lifecycleStatus === "completion_review" ||
            workOrder.lifecycleStatus === "ready_for_invoicing") &&
          input.toStatus === "invoiced"
        ) ||
        (workOrder.lifecycleStatus === "invoiced" &&
          (input.toStatus === "paid" || input.toStatus === "ready_for_invoicing"))
      );

    if (!allowed) {
      return serviceFail(
        validationError(
          `Actor role ${role} may not drive invoice workflow transition ${workOrder.lifecycleStatus} -> ${input.toStatus}.`,
        ),
      );
    }

    return serviceOk(true);
  }

  private toPermissionTarget(workOrder: WorkOrder): WorkOrderPermissionTarget & {
    status: WorkOrderStatus;
  } {
    return {
      id: workOrder.id,
      organizationId: workOrder.organizationId,
      clientOrganizationId: workOrder.clientOrganizationId,
      locationId: workOrder.locationId,
      status: workOrder.lifecycleStatus,
      requestedByContactId: workOrder.requestedByContactId,
      coordinatorUserId: workOrder.coordinatorUserId,
      managerUserId: workOrder.managerUserId,
      assignedContractorId: workOrder.assignedContractorOrgId,
    };
  }

  private normalizeScopedWorkOrder(
    workOrder: WorkOrder,
    input: WorkOrderMutationContext,
  ): ServiceResult<WorkOrder> {
    if (
      workOrder.organizationId &&
      workOrder.organizationId !== input.organizationId
    ) {
      return serviceFail(notFoundError("Work order could not be found."));
    }

    return serviceOk({
      ...workOrder,
      organizationId: workOrder.organizationId ?? input.organizationId,
    });
  }

  private async applyTransition(
    workOrder: WorkOrder,
    input: TransitionWorkOrderInput,
    options: {
      allowInvoiceReopen?: boolean;
      emitCanonicalLifecycleEvent?: boolean;
      emitReadyForInvoicingNotification?: boolean;
      transitionMetadata?: Record<string, unknown>;
      mutateBeforeSave?: (workOrder: WorkOrder, timestamp: string) => WorkOrder;
    } = {},
  ): Promise<ServiceResult<WorkOrder>> {
    const scopedWorkOrder = this.normalizeScopedWorkOrder(workOrder, input);
    if (!scopedWorkOrder.ok) {
      return scopedWorkOrder;
    }

    const validation = await this.validateTransition(scopedWorkOrder.value, input, {
      allowInvoiceReopen: options.allowInvoiceReopen,
    });
    if (!validation.ok) {
      return validation;
    }

    const timestamp = input.now ?? new Date().toISOString();
    const transitionDraft: WorkOrder = {
      ...scopedWorkOrder.value,
      lifecycleStatus: input.toStatus,
      previousLifecycleStatus:
        input.toStatus === "on_hold" || input.toStatus === "escalated"
          ? scopedWorkOrder.value.lifecycleStatus
          : scopedWorkOrder.value.previousLifecycleStatus,
      triagedAt:
        input.toStatus === "triage"
          ? scopedWorkOrder.value.triagedAt ?? timestamp
          : scopedWorkOrder.value.triagedAt,
      contractorScheduledAt:
        input.toStatus === "contractor_scheduled"
          ? scopedWorkOrder.value.contractorScheduledAt ?? timestamp
          : scopedWorkOrder.value.contractorScheduledAt,
      workStartedAt:
        input.toStatus === "in_progress"
          ? scopedWorkOrder.value.workStartedAt ?? timestamp
          : scopedWorkOrder.value.workStartedAt,
      clientApprovedAt:
        input.toStatus === "client_approved"
          ? scopedWorkOrder.value.clientApprovedAt ?? timestamp
          : scopedWorkOrder.value.clientApprovedAt,
      workCompletedAt:
        input.toStatus === "work_completed"
          ? scopedWorkOrder.value.workCompletedAt ?? timestamp
          : scopedWorkOrder.value.workCompletedAt,
      completionReviewStartedAt:
        input.toStatus === "completion_review"
          ? scopedWorkOrder.value.completionReviewStartedAt ?? timestamp
          : scopedWorkOrder.value.completionReviewStartedAt,
      readyForInvoicingAt:
        input.toStatus === "ready_for_invoicing"
          ? scopedWorkOrder.value.readyForInvoicingAt ?? timestamp
          : scopedWorkOrder.value.readyForInvoicingAt,
      paidAt:
        input.toStatus === "paid"
          ? scopedWorkOrder.value.paidAt ?? timestamp
          : scopedWorkOrder.value.paidAt,
      closedAt:
        input.toStatus === "closed"
          ? scopedWorkOrder.value.closedAt ?? timestamp
          : scopedWorkOrder.value.closedAt,
      cancelledAt:
        input.toStatus === "cancelled"
          ? scopedWorkOrder.value.cancelledAt ?? timestamp
          : scopedWorkOrder.value.cancelledAt,
      holdStartedAt:
        input.toStatus === "on_hold"
          ? scopedWorkOrder.value.holdStartedAt ?? timestamp
          : scopedWorkOrder.value.holdStartedAt,
      escalatedAt:
        input.toStatus === "escalated"
          ? scopedWorkOrder.value.escalatedAt ?? timestamp
          : scopedWorkOrder.value.escalatedAt,
      isEscalated:
        input.toStatus === "escalated"
          ? true
          : input.toStatus === "on_hold" ||
              input.toStatus === "closed" ||
              input.toStatus === "cancelled"
            ? scopedWorkOrder.value.isEscalated
            : false,
      lastActivityAt: timestamp,
    };

    const transitioned = touchAuditFields(
      options.mutateBeforeSave
        ? options.mutateBeforeSave(transitionDraft, timestamp)
        : transitionDraft,
      { ...input, now: timestamp },
    );

    const persistTransition = async (atomic?: WorkOrderMutationContext["atomic"]) => {
      if (atomic) {
        atomic.save("workOrders", transitioned);
      } else {
        await this.repositories.workOrders.save(transitioned);
      }
      await this.dependencies.domainEvents.recordTransition({
        ...input,
        atomic,
        now: timestamp,
        workOrderId: transitioned.id,
        fromLifecycleStatus: scopedWorkOrder.value.lifecycleStatus,
        toLifecycleStatus: input.toStatus,
        visibility: "internal",
        reason: input.activityMessage ?? null,
        escalationContext:
          input.toStatus === "escalated"
            ? { previousLifecycleStatus: scopedWorkOrder.value.lifecycleStatus }
            : null,
        holdContext:
          input.toStatus === "on_hold"
            ? { previousLifecycleStatus: scopedWorkOrder.value.lifecycleStatus }
            : null,
        metadata: {
          workOrderNumber: transitioned.workOrderNumber,
          ...(options.transitionMetadata ?? {}),
        },
      });

      if (options.emitCanonicalLifecycleEvent !== false) {
        const canonicalEventType = mapLifecycleStatusToEventType(input.toStatus);
        if (canonicalEventType) {
          await this.dependencies.domainEvents.record({
            ...input,
            atomic,
            now: timestamp,
            workOrderId: transitioned.id,
            type: canonicalEventType,
            visibility: "internal",
            lifecycleStatus: transitioned.lifecycleStatus,
            entity: {
              entityType: "work_order",
              entityId: transitioned.id,
              label: transitioned.workOrderNumber,
            },
            summary:
              input.activityMessage ??
              `Changed work order lifecycle from ${scopedWorkOrder.value.lifecycleStatus} to ${input.toStatus}.`,
            reason: input.activityMessage ?? null,
            payload: eventPayloadForLifecycleStatus(
              canonicalEventType,
              transitioned,
              scopedWorkOrder.value.lifecycleStatus,
              input.activityMessage ?? null,
            ),
          });
        }
      }
    };

    if (input.atomic) {
      await persistTransition(input.atomic);
    } else if (this.dependencies.atomicPersistence) {
      await this.dependencies.atomicPersistence.runInTransaction(async (atomic) => {
        await persistTransition(atomic);
      });
    } else {
      await persistTransition();
    }

    if (
      input.toStatus === "ready_for_invoicing" &&
      options.emitReadyForInvoicingNotification !== false
    ) {
      await this.dependencies.notifications?.captureOperationalEvent({
        ...input,
        now: timestamp,
        eventType: "work_order_ready_for_invoicing",
        entityType: "work-order",
        entityId: transitioned.id,
        workOrder: transitioned,
        fromStatus: scopedWorkOrder.value.lifecycleStatus,
        toStatus: input.toStatus,
      });
    }

    return serviceOk(transitioned);
  }
}

function mapLifecycleStatusToEventType(
  status: WorkOrderStatus,
):
  | "quote_requested"
  | "client_approved"
  | "work_started"
  | "work_completed"
  | "work_order_closed"
  | "work_order_cancelled"
  | "work_order_on_hold"
  | "work_order_escalated"
  | null {
  switch (status) {
    case "quote_required":
      return "quote_requested";
    case "client_approved":
      return "client_approved";
    case "in_progress":
      return "work_started";
    case "work_completed":
      return "work_completed";
    case "closed":
      return "work_order_closed";
    case "cancelled":
      return "work_order_cancelled";
    case "on_hold":
      return "work_order_on_hold";
    case "escalated":
      return "work_order_escalated";
    default:
      return null;
  }
}

function eventPayloadForLifecycleStatus(
  type:
    | "quote_requested"
    | "client_approved"
    | "work_started"
    | "work_completed"
    | "work_order_closed"
    | "work_order_cancelled"
    | "work_order_on_hold"
    | "work_order_escalated",
  workOrder: WorkOrder,
  fromLifecycleStatus: WorkOrderStatus,
  reason: string | null,
) {
  switch (type) {
    case "quote_requested":
      return { workOrderId: workOrder.id };
    case "client_approved":
      return {
        quoteId: workOrder.currentQuoteId ?? workOrder.id,
        status: workOrder.lifecycleStatus,
      };
    case "work_started":
    case "work_completed":
    case "work_order_closed":
      return { fromLifecycleStatus };
    case "work_order_cancelled":
    case "work_order_on_hold":
    case "work_order_escalated":
      return { fromLifecycleStatus, reason };
  }
}

function validateRequiredTextFields(fields: Record<string, string>): ReturnType<typeof validationError> | null {
  for (const [field, value] of Object.entries(fields)) {
    if (!value.trim()) {
      return validationError(`${field} is required.`);
    }
  }

  return null;
}

function buildLocationSnapshot(
  location: Location,
): WorkOrder["locationSnapshot"] {
  return {
    id: location.id,
    name: location.name,
    addressText: [
      location.addressLine1,
      location.addressLine2,
      location.city,
      location.region,
      location.postalCode,
      location.countryCode,
    ]
      .filter(Boolean)
      .join(", ") || null,
  };
}
