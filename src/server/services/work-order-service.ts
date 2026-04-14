import "server-only";

import type {
  FirestoreRepositories,
  Location,
  WorkOrder,
} from "@/server/repositories";
import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { WorkOrderPriority, WorkOrderStatus } from "@/types/work-order";
import { conflictError, invalidTransitionError, notFoundError, validationError } from "./errors.ts";
import {
  canWorkOrderTransition,
  isTerminalWorkOrderStatus,
} from "./status-rules.ts";
import type { ActivityLogService } from "./activity-log-service.ts";
import type { NotificationService } from "./notification-service.ts";
import type { ClientLocationService } from "./client-location-service.ts";
import { createServiceLogger } from "./observability.ts";
import {
  createAuditFields,
  serviceFail,
  serviceOk,
  touchAuditFields,
  type ServiceAuditContext,
  type ServiceResult,
} from "./types.ts";

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

export interface CreateWorkOrderServiceInput extends ServiceAuditContext {
  title: string;
  description: string;
  priority: WorkOrderPriority;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  requestedByUserId?: EntityId | null;
  assignedCoordinatorUserId?: EntityId | null;
  assignedManagerUserId?: EntityId | null;
  category?: string | null;
  requestedServiceDate?: IsoDateTimeString | null;
}

export interface UpdateWorkOrderServiceInput extends ServiceAuditContext {
  workOrderId: EntityId;
  title?: string;
  description?: string;
  priority?: WorkOrderPriority;
  clientOrganizationId?: EntityId;
  locationId?: EntityId;
  assignedCoordinatorUserId?: EntityId | null;
  assignedManagerUserId?: EntityId | null;
  category?: string | null;
  requestedServiceDate?: IsoDateTimeString | null;
}

export interface AssignInternalStaffInput extends ServiceAuditContext {
  workOrderId: EntityId;
  assignedCoordinatorUserId?: EntityId | null;
  assignedManagerUserId?: EntityId | null;
}

export interface AssignContractorToWorkOrderInput extends ServiceAuditContext {
  workOrderId: EntityId;
  contractorOrganizationId: EntityId | null;
}

export interface AddWorkOrderNoteInput extends ServiceAuditContext {
  workOrderId: EntityId;
  note: string;
  noteType: "internal" | "operational";
}

export interface TransitionWorkOrderInput extends ServiceAuditContext {
  workOrderId: EntityId;
  toStatus: WorkOrderStatus;
  completionAccepted?: boolean;
  activityMessage?: string;
}

export function createWorkOrderService(
  repositories: Pick<
    FirestoreRepositories,
    "workOrders" | "quotes" | "invoices" | "clientOrganizations" | "locations"
    | "contractorOrganizations"
  >,
  dependencies: {
    activityLogs: ActivityLogService;
    clientLocations: ClientLocationService;
    notifications?: NotificationService;
  },
): WorkOrderService {
  return new FirestoreWorkOrderService(repositories, dependencies);
}

class FirestoreWorkOrderService implements WorkOrderService {
  private readonly repositories: Pick<
    FirestoreRepositories,
    "workOrders" | "quotes" | "invoices" | "clientOrganizations" | "locations"
    | "contractorOrganizations"
  >;

  private readonly dependencies: {
    activityLogs: ActivityLogService;
    clientLocations: ClientLocationService;
    notifications?: NotificationService;
  };

  constructor(
    repositories: Pick<
      FirestoreRepositories,
      "workOrders" | "quotes" | "invoices" | "clientOrganizations" | "locations"
      | "contractorOrganizations"
    >,
    dependencies: {
      activityLogs: ActivityLogService;
      clientLocations: ClientLocationService;
      notifications?: NotificationService;
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
    const logger = createServiceLogger("work_order.create", input);
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

    const id = this.repositories.workOrders.newId();
    const workOrder: WorkOrder = {
      id,
      ...createAuditFields(input),
      workOrderNumber: `WO-${id.slice(0, 8).toUpperCase()}`,
      title: input.title.trim(),
      description: input.description.trim(),
      status: "new",
      priority: input.priority,
      clientOrganizationId: input.clientOrganizationId,
      locationId: input.locationId,
      requestedByUserId: input.requestedByUserId ?? input.actor.userId,
      assignedCoordinatorUserId: input.assignedCoordinatorUserId ?? null,
      assignedManagerUserId: input.assignedManagerUserId ?? null,
      assignedContractorOrganizationId: null,
      currentQuoteId: null,
      currentInvoiceId: null,
      clientSnapshot: {
        id: clientLocation.value.client.id,
        name: clientLocation.value.client.displayName ?? clientLocation.value.client.name,
      },
      locationSnapshot: buildLocationSnapshot(clientLocation.value.location),
      contractorSnapshot: null,
      category: input.category ?? null,
      requestedServiceDate: input.requestedServiceDate ?? null,
      submittedAt: null,
      approvedAt: null,
      completedAt: null,
      closedAt: null,
    };

    await this.repositories.workOrders.create(workOrder);
    await this.dependencies.activityLogs.record({
      ...input,
      workOrderId: workOrder.id,
      action: "work_order.created",
      eventType: "work_order_created",
      message: `Created ${workOrder.workOrderNumber}.`,
      entityType: "workOrder",
      entityId: workOrder.id,
      entityLabel: workOrder.workOrderNumber,
      visibility: "internal",
      changes: [
        { field: "status", to: workOrder.status },
        { field: "priority", to: workOrder.priority },
        { field: "clientOrganizationId", to: workOrder.clientOrganizationId },
        { field: "locationId", to: workOrder.locationId },
      ],
      metadata: {
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
      },
    });
    logger.info("use_case.completed", {
      action: "work_order.created",
      resource: {
        type: "workOrder",
        id: workOrder.id,
        label: workOrder.workOrderNumber,
      },
      status: workOrder.status,
    });

    return serviceOk(workOrder);
  }

  async update(
    input: UpdateWorkOrderServiceInput,
  ): Promise<ServiceResult<WorkOrder>> {
    const logger = createServiceLogger("work_order.update", input);
    const existing = await this.getById(input.workOrderId);
    if (!existing.ok) {
      return existing;
    }

    if (isTerminalWorkOrderStatus(existing.value.status)) {
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
        assignedCoordinatorUserId:
          input.assignedCoordinatorUserId ?? existing.value.assignedCoordinatorUserId,
        assignedManagerUserId:
          input.assignedManagerUserId ?? existing.value.assignedManagerUserId,
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

    await this.repositories.workOrders.save(updated);
    await this.dependencies.activityLogs.record({
      ...input,
      workOrderId: updated.id,
      action: "work_order.updated",
      eventType: "work_order_updated",
      message: `Updated ${updated.workOrderNumber}.`,
      entityType: "workOrder",
      entityId: updated.id,
      entityLabel: updated.workOrderNumber,
      visibility: "internal",
      metadata: {
        workOrderNumber: updated.workOrderNumber,
      },
    });
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
    const logger = createServiceLogger("work_order.assign_internal_staff", input);
    const existing = await this.getById(input.workOrderId);
    if (!existing.ok) {
      return existing;
    }

    if (isTerminalWorkOrderStatus(existing.value.status)) {
      return serviceFail(
        conflictError("Terminal work orders cannot be reassigned."),
      );
    }

    const updated = touchAuditFields(
      {
        ...existing.value,
        assignedCoordinatorUserId:
          "assignedCoordinatorUserId" in input
            ? input.assignedCoordinatorUserId ?? null
            : existing.value.assignedCoordinatorUserId,
        assignedManagerUserId:
          "assignedManagerUserId" in input
            ? input.assignedManagerUserId ?? null
            : existing.value.assignedManagerUserId,
      },
      input,
    );

    await this.repositories.workOrders.save(updated);
    await this.dependencies.activityLogs.record({
      ...input,
      workOrderId: updated.id,
      action: "work_order.assigned",
      eventType: "work_order_internal_staff_assigned",
      message: `Updated internal assignment for ${updated.workOrderNumber}.`,
      entityType: "workOrder",
      entityId: updated.id,
      entityLabel: updated.workOrderNumber,
      visibility: "internal",
      changes: [
        {
          field: "assignedCoordinatorUserId",
          from: existing.value.assignedCoordinatorUserId,
          to: updated.assignedCoordinatorUserId,
        },
        {
          field: "assignedManagerUserId",
          from: existing.value.assignedManagerUserId,
          to: updated.assignedManagerUserId,
        },
      ],
      metadata: {
        assignedCoordinatorUserId: updated.assignedCoordinatorUserId,
        assignedManagerUserId: updated.assignedManagerUserId,
      },
    });
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
    const logger = createServiceLogger("work_order.assign_contractor", input);
    const existing = await this.getById(input.workOrderId);
    if (!existing.ok) {
      return existing;
    }

    if (isTerminalWorkOrderStatus(existing.value.status)) {
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
        assignedContractorOrganizationId: contractor?.id ?? null,
        contractorSnapshot: contractor
          ? {
              id: contractor.id,
              name: contractor.displayName ?? contractor.name,
            }
          : null,
        status:
          contractor && existing.value.status === "approved_to_proceed"
            ? "assigned"
            : existing.value.status,
      },
      input,
    );

    await this.repositories.workOrders.save(updated);
    await this.dependencies.activityLogs.record({
      ...input,
      workOrderId: updated.id,
      action: "work_order.assigned",
      eventType: contractor
        ? "contractor_assigned"
        : "contractor_assignment_cleared",
      message: contractor
        ? `Assigned ${contractor.displayName ?? contractor.name}.`
        : "Cleared contractor assignment.",
      entityType: "workOrder",
      entityId: updated.id,
      entityLabel: updated.workOrderNumber,
      visibility: "internal",
      changes: [
        {
          field: "assignedContractorOrganizationId",
          from: existing.value.assignedContractorOrganizationId,
          to: updated.assignedContractorOrganizationId,
        },
      ],
      metadata: {
        contractorOrganizationId: updated.assignedContractorOrganizationId,
      },
    });
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

  async addNote(input: AddWorkOrderNoteInput): Promise<ServiceResult<WorkOrder>> {
    const logger = createServiceLogger("work_order.add_note", input);
    const existing = await this.getById(input.workOrderId);
    if (!existing.ok) {
      return existing;
    }

    const note = input.note.trim();
    if (!note) {
      return serviceFail(validationError("Note is required."));
    }

    const updated = touchAuditFields(existing.value, input);
    await this.repositories.workOrders.save(updated);
    await this.dependencies.activityLogs.record({
      ...input,
      workOrderId: updated.id,
      action: "work_order.updated",
      eventType:
        input.noteType === "internal"
          ? "internal_note_added"
          : "operational_note_added",
      message: note,
      entityType: "workOrder",
      entityId: updated.id,
      entityLabel: updated.workOrderNumber,
      visibility: input.noteType === "internal" ? "internal" : "all",
      metadata: {
        noteType: input.noteType,
      },
    });
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
    const logger = createServiceLogger("work_order.transition", input);
    const existing = await this.getById(input.workOrderId);
    if (!existing.ok) {
      return existing;
    }

    const validation = await this.validateTransition(existing.value, input);
    if (!validation.ok) {
      return validation;
    }

    const timestamp = input.now ?? new Date().toISOString();
    const transitioned = touchAuditFields(
      {
        ...existing.value,
        status: input.toStatus,
        submittedAt:
          input.toStatus === "submitted"
            ? existing.value.submittedAt ?? timestamp
            : existing.value.submittedAt,
        approvedAt:
          input.toStatus === "approved_to_proceed" || input.toStatus === "approved"
            ? existing.value.approvedAt ?? timestamp
            : existing.value.approvedAt,
        completedAt:
          input.toStatus === "completed"
            ? existing.value.completedAt ?? timestamp
            : existing.value.completedAt,
        closedAt:
          input.toStatus === "closed"
            ? existing.value.closedAt ?? timestamp
            : existing.value.closedAt,
      },
      { ...input, now: timestamp },
    );

    await this.repositories.workOrders.save(transitioned);
    await this.dependencies.activityLogs.record({
      ...input,
      now: timestamp,
      workOrderId: transitioned.id,
      action: "work_order.status_changed",
      eventType: "work_order_status_changed",
      message:
        input.activityMessage ??
        `Changed work order status from ${existing.value.status} to ${input.toStatus}.`,
      entityType: "workOrder",
      entityId: transitioned.id,
      entityLabel: transitioned.workOrderNumber,
      visibility: "internal",
      changes: [
        {
          field: "status",
          from: existing.value.status,
          to: input.toStatus,
        },
      ],
      metadata: {
        fromStatus: existing.value.status,
        toStatus: input.toStatus,
      },
    });
    logger.info("use_case.completed", {
      action: "work_order.status_changed",
      resource: {
        type: "workOrder",
        id: transitioned.id,
        label: transitioned.workOrderNumber,
      },
      fromStatus: existing.value.status,
      toStatus: input.toStatus,
    });

    if (input.toStatus === "ready_for_invoicing") {
      await this.dependencies.notifications?.captureOperationalEvent({
        ...input,
        now: timestamp,
        eventType: "work_order_ready_for_invoicing",
        entityType: "work-order",
        entityId: transitioned.id,
        workOrder: transitioned,
        fromStatus: existing.value.status,
        toStatus: input.toStatus,
      });
    }

    return serviceOk(transitioned);
  }

  private async validateTransition(
    workOrder: WorkOrder,
    input: TransitionWorkOrderInput,
  ): Promise<ServiceResult<true>> {
    if (isTerminalWorkOrderStatus(workOrder.status)) {
      return serviceFail(
        invalidTransitionError(
          `Work order status ${workOrder.status} is terminal.`,
        ),
      );
    }

    if (!canWorkOrderTransition(workOrder.status, input.toStatus)) {
      return serviceFail(
        invalidTransitionError(
          `Work order cannot transition from ${workOrder.status} to ${input.toStatus}.`,
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

    if (input.toStatus === "completed" && !input.completionAccepted) {
      return serviceFail(
        validationError("Completion must be accepted before the work order is completed."),
      );
    }

    if (input.toStatus === "invoiced") {
      const invoices = await this.repositories.invoices.listByWorkOrderId(
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
      const invoices = await this.repositories.invoices.listByWorkOrderId(
        workOrder.id,
      );
      const currentInvoice = invoices.items.find(
        (invoice) => invoice.id === workOrder.currentInvoiceId,
      );
      if (workOrder.status === "paid" && currentInvoice?.status !== "paid") {
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
      "approved_to_proceed",
      "dispatched",
      "assigned",
      "scheduled",
      "in_progress",
    ]);

    if (!quoteGatedStatuses.has(toStatus)) {
      return serviceOk(true);
    }

    const isQuotePath =
      workOrder.currentQuoteId != null ||
      workOrder.status === "quote_requested" ||
      workOrder.status === "quote_received" ||
      workOrder.status === "pending_client_approval";

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

    const clientQuoteRepository = (this.repositories as FirestoreRepositories).clientQuotes;
    const quote = clientQuoteRepository
      ? await clientQuoteRepository.getById(workOrder.currentQuoteId)
      : await this.repositories.quotes.getById(workOrder.currentQuoteId);
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
