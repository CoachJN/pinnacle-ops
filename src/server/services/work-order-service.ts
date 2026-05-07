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
import type { DomainEventService } from "./domain-event-service.ts";
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
  requestedByContactId?: EntityId | null;
  siteContactId?: EntityId | null;
  requestedByName?: string | null;
  requestedByEmail?: string | null;
  requestedByPhone?: string | null;
  coordinatorUserId?: EntityId | null;
  managerUserId?: EntityId | null;
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
  coordinatorUserId?: EntityId | null;
  managerUserId?: EntityId | null;
  category?: string | null;
  requestedServiceDate?: IsoDateTimeString | null;
}

export interface AssignInternalStaffInput extends ServiceAuditContext {
  workOrderId: EntityId;
  coordinatorUserId?: EntityId | null;
  managerUserId?: EntityId | null;
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
    "workOrders" | "clientQuotes" | "clientInvoices" | "clientOrganizations" | "locations"
    | "contractorOrganizations"
  >,
  dependencies: {
    domainEvents: DomainEventService;
    clientLocations: ClientLocationService;
    notifications?: NotificationService;
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
      poNumber: null,
      requestedByName: input.requestedByName?.trim() || null,
      requestedByEmail: input.requestedByEmail?.trim() || null,
      requestedByPhone: input.requestedByPhone?.trim() || null,
      requestedServiceDate: input.requestedServiceDate ?? null,
      dueDate: null,
      category: input.category ?? null,
      requiresQuote: false,
      quoteRequiredThresholdCents: null,
      lifecycleStatus: input.requestedServiceDate ? "triage" : "new",
      status: input.requestedServiceDate ? "triage" : "new",
      assignmentStatus: null,
      quoteSummaryStatus: "not_required",
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

    await this.repositories.workOrders.create(workOrder);
    await this.dependencies.domainEvents.record({
      ...input,
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
    const logger = createServiceLogger("work_order.update", input);
    const existing = await this.getById(input.workOrderId);
    if (!existing.ok) {
      return existing;
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

    await this.repositories.workOrders.save(updated);
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

    await this.repositories.workOrders.save(updated);
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
        assignedAt: contractor ? (input.now ?? new Date().toISOString()) : existing.value.assignedAt,
      },
      input,
    );

    await this.repositories.workOrders.save(updated);
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
        lifecycleStatus: input.toStatus,
        previousLifecycleStatus:
          input.toStatus === "on_hold" || input.toStatus === "escalated"
            ? existing.value.lifecycleStatus
            : existing.value.previousLifecycleStatus,
        triagedAt:
          input.toStatus === "triage"
            ? existing.value.triagedAt ?? timestamp
            : existing.value.triagedAt,
        contractorScheduledAt:
          input.toStatus === "contractor_scheduled"
            ? existing.value.contractorScheduledAt ?? timestamp
            : existing.value.contractorScheduledAt,
        workStartedAt:
          input.toStatus === "in_progress"
            ? existing.value.workStartedAt ?? timestamp
            : existing.value.workStartedAt,
        clientApprovedAt:
          input.toStatus === "client_approved"
            ? existing.value.clientApprovedAt ?? timestamp
            : existing.value.clientApprovedAt,
        workCompletedAt:
          input.toStatus === "work_completed"
            ? existing.value.workCompletedAt ?? timestamp
            : existing.value.workCompletedAt,
        completionReviewStartedAt:
          input.toStatus === "completion_review"
            ? existing.value.completionReviewStartedAt ?? timestamp
            : existing.value.completionReviewStartedAt,
        readyForInvoicingAt:
          input.toStatus === "ready_for_invoicing"
            ? existing.value.readyForInvoicingAt ?? timestamp
            : existing.value.readyForInvoicingAt,
        paidAt:
          input.toStatus === "paid"
            ? existing.value.paidAt ?? timestamp
            : existing.value.paidAt,
        closedAt:
          input.toStatus === "closed"
            ? existing.value.closedAt ?? timestamp
            : existing.value.closedAt,
        cancelledAt:
          input.toStatus === "cancelled"
            ? existing.value.cancelledAt ?? timestamp
            : existing.value.cancelledAt,
        holdStartedAt:
          input.toStatus === "on_hold"
            ? existing.value.holdStartedAt ?? timestamp
            : existing.value.holdStartedAt,
        escalatedAt:
          input.toStatus === "escalated"
            ? existing.value.escalatedAt ?? timestamp
            : existing.value.escalatedAt,
        isEscalated:
          input.toStatus === "escalated"
            ? true
            : input.toStatus === "on_hold" || input.toStatus === "closed" || input.toStatus === "cancelled"
              ? existing.value.isEscalated
              : false,
        lastActivityAt: timestamp,
      },
      { ...input, now: timestamp },
    );

    await this.repositories.workOrders.save(transitioned);
    await this.dependencies.domainEvents.recordTransition({
      ...input,
      now: timestamp,
      workOrderId: transitioned.id,
      fromLifecycleStatus: existing.value.lifecycleStatus,
      toLifecycleStatus: input.toStatus,
      visibility: "internal",
      reason: input.activityMessage ?? null,
      escalationContext:
        input.toStatus === "escalated"
          ? { previousLifecycleStatus: existing.value.lifecycleStatus }
          : null,
      holdContext:
        input.toStatus === "on_hold"
          ? { previousLifecycleStatus: existing.value.lifecycleStatus }
          : null,
      metadata: {
        workOrderNumber: transitioned.workOrderNumber,
      },
    });
    const canonicalEventType = mapLifecycleStatusToEventType(input.toStatus);
    if (canonicalEventType) {
      await this.dependencies.domainEvents.record({
        ...input,
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
          `Changed work order lifecycle from ${existing.value.lifecycleStatus} to ${input.toStatus}.`,
        reason: input.activityMessage ?? null,
        payload: eventPayloadForLifecycleStatus(
          canonicalEventType,
          transitioned,
          existing.value.lifecycleStatus,
          input.activityMessage ?? null,
        ),
      });
    }
    logger.info("use_case.completed", {
      action: "work_order.status_changed",
      resource: {
        type: "workOrder",
        id: transitioned.id,
        label: transitioned.workOrderNumber,
      },
      fromLifecycleStatus: existing.value.lifecycleStatus,
      toLifecycleStatus: input.toStatus,
    });

    if (input.toStatus === "ready_for_invoicing") {
      await this.dependencies.notifications?.captureOperationalEvent({
        ...input,
        now: timestamp,
        eventType: "work_order_ready_for_invoicing",
        entityType: "work-order",
        entityId: transitioned.id,
        workOrder: transitioned,
        fromStatus: existing.value.lifecycleStatus,
        toStatus: input.toStatus,
      });
    }

    return serviceOk(transitioned);
  }

  private async validateTransition(
    workOrder: WorkOrder,
    input: TransitionWorkOrderInput,
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
