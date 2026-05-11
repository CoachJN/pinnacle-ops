import "server-only";

import type {
  ClientInvoice,
  FirestoreRepositories,
  WorkOrder,
} from "@/server/repositories";
import {
  createInvoiceFromWorkOrderSchema,
  sendInvoiceSchema,
  updateInvoiceDraftSchema,
  markInvoiceViewedSchema,
  markInvoicePaidSchema,
  voidInvoiceSchema,
} from "@/lib/validation/invoice";
import type {
  EntityId,
  IsoDateTimeString,
} from "@/types/entity";
import type {
  InvoiceCurrency,
  InvoiceLineItem,
  InvoiceStatus,
  QboSyncStatus,
} from "@/types/invoice";
import type { WorkOrderStatus } from "@/types/work-order";
import {
  buildInvoiceCreationEligibility,
  financeQueuePriority,
  isTerminalInvoiceStatus,
  isWorkOrderEligibleForInvoiceCreation,
} from "@/modules/finance";
import { invalidTransitionError, notFoundError, validationError } from "./errors.ts";
import type { DomainEventService } from "./domain-event-service.ts";
import { createServiceLogger } from "./observability.ts";
import {
  canInvoiceTransition,
} from "./status-rules.ts";
import {
  createAuditFields,
  serviceFail,
  serviceOk,
  touchAuditFields,
  type ServiceResult,
} from "./types.ts";
import type { NotificationService } from "./notification-service.ts";
import type { WorkOrderService } from "./work-order-service.ts";
import type { WorkOrderMutationContext } from "./work-order-mutation-context.ts";
import type { AtomicPersistenceContext, AtomicPersistenceService } from "./atomic-persistence-service.ts";

type Invoice = ClientInvoice;

export interface InvoiceService {
  getById(invoiceId: EntityId): Promise<ServiceResult<ClientInvoice>>;
  getInvoiceById(invoiceId: EntityId): Promise<ServiceResult<ClientInvoice>>;
  listByWorkOrderId(workOrderId: EntityId): Promise<ServiceResult<ClientInvoice[]>>;
  getInvoicesForWorkOrder(workOrderId: EntityId): Promise<ServiceResult<ClientInvoice[]>>;
  listFinanceQueue(input?: ListFinanceQueueInput): Promise<ServiceResult<ClientInvoice[]>>;
  create(input: CreateInvoiceServiceInput): Promise<ServiceResult<ClientInvoice>>;
  createInvoiceFromWorkOrder(
    input: CreateInvoiceServiceInput,
  ): Promise<ServiceResult<ClientInvoice>>;
  updateDraft(input: UpdateInvoiceDraftInput): Promise<ServiceResult<ClientInvoice>>;
  updateInvoiceDraft(
    input: UpdateInvoiceDraftInput,
  ): Promise<ServiceResult<ClientInvoice>>;
  transition(input: TransitionInvoiceInput): Promise<ServiceResult<ClientInvoice>>;
  sendInvoice(input: SendInvoiceInput): Promise<ServiceResult<ClientInvoice>>;
  markInvoiceViewed(
    input: MarkInvoiceViewedInput,
  ): Promise<ServiceResult<ClientInvoice>>;
  markInvoiceOverdue(
    input: MarkInvoiceOverdueInput,
  ): Promise<ServiceResult<ClientInvoice>>;
  markInvoicePaid(input: MarkInvoicePaidInput): Promise<ServiceResult<ClientInvoice>>;
  voidInvoice(input: VoidInvoiceInput): Promise<ServiceResult<ClientInvoice>>;
  prepareInvoiceForAccountingSync(
    invoiceId: EntityId,
  ): Promise<ServiceResult<AccountingSyncPayload>>;
  markInvoiceSyncPending(
    input: InvoiceSyncMutationInput,
  ): Promise<ServiceResult<ClientInvoice>>;
  markInvoiceSyncSuccess(
    input: InvoiceSyncSuccessInput,
  ): Promise<ServiceResult<ClientInvoice>>;
  markInvoiceSyncFailed(
    input: InvoiceSyncMutationInput,
  ): Promise<ServiceResult<ClientInvoice>>;
}

export interface ListFinanceQueueInput {
  limit?: number;
  statuses?: InvoiceStatus[];
}

export interface CreateInvoiceServiceInput extends WorkOrderMutationContext {
  workOrderId: EntityId;
  dueDate: string;
  currency: InvoiceCurrency;
  lineItems: InvoiceLineItem[];
  taxAmount: number;
  subtotal?: number;
  totalAmount?: number;
  notes?: string | null;
}

export interface UpdateInvoiceDraftInput extends CreateInvoiceServiceInput {
  invoiceId: EntityId;
}

export interface TransitionInvoiceInput extends WorkOrderMutationContext {
  workOrderId: EntityId;
  invoiceId: EntityId;
  toStatus: InvoiceStatus;
  paymentReference?: string | null;
  issuedDate?: string;
  sentAt?: string;
  viewedAt?: string;
  paidAt?: string;
  voidedAt?: string;
}

export interface SendInvoiceInput extends WorkOrderMutationContext {
  workOrderId: EntityId;
  invoiceId: EntityId;
  issuedDate?: string;
  sentAt?: string;
}

export interface MarkInvoiceViewedInput extends WorkOrderMutationContext {
  workOrderId: EntityId;
  invoiceId: EntityId;
  viewedAt?: string;
}

export interface MarkInvoiceOverdueInput extends WorkOrderMutationContext {
  workOrderId: EntityId;
  invoiceId: EntityId;
}

export interface MarkInvoicePaidInput extends WorkOrderMutationContext {
  workOrderId: EntityId;
  invoiceId: EntityId;
  paidAt?: string;
  paymentReference?: string | null;
}

export interface VoidInvoiceInput extends WorkOrderMutationContext {
  workOrderId: EntityId;
  invoiceId: EntityId;
  voidedAt?: string;
}

export interface InvoiceSyncMutationInput extends WorkOrderMutationContext {
  invoiceId: EntityId;
}

export interface InvoiceSyncSuccessInput extends InvoiceSyncMutationInput {
  qboInvoiceId: string;
}

export interface AccountingSyncPayload {
  invoiceId: EntityId;
  workOrderId: EntityId;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  invoiceNumber: string;
  status: InvoiceStatus;
  currency: InvoiceCurrency;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  issuedDate: IsoDateTimeString | null;
  dueDate: IsoDateTimeString;
  sentAt: IsoDateTimeString | null;
  viewedAt: IsoDateTimeString | null;
  paidAt: IsoDateTimeString | null;
  paymentReference: string | null;
  notes: string | null;
  qboInvoiceId: string | null;
  qboSyncStatus: QboSyncStatus | null;
}

export function createInvoiceService(
  repositories: Pick<FirestoreRepositories, "workOrders" | "clientInvoices">,
  dependencies: {
    domainEvents: DomainEventService;
    workOrders: Pick<
      WorkOrderService,
      "applyInvoiceWorkflowPointer" | "applyInvoiceWorkflowTransition"
    >;
    notifications?: NotificationService;
    atomicPersistence?: AtomicPersistenceService;
  },
): InvoiceService {
  return new FirestoreInvoiceService(repositories, dependencies);
}

class FirestoreInvoiceService implements InvoiceService {
  private readonly repositories: Pick<
    FirestoreRepositories,
    "workOrders" | "clientInvoices"
  >;

  private readonly dependencies: {
    domainEvents: DomainEventService;
    workOrders: Pick<
      WorkOrderService,
      "applyInvoiceWorkflowPointer" | "applyInvoiceWorkflowTransition"
    >;
    notifications?: NotificationService;
    atomicPersistence?: AtomicPersistenceService;
  };

  constructor(
    repositories: Pick<FirestoreRepositories, "workOrders" | "clientInvoices">,
    dependencies: {
      domainEvents: DomainEventService;
      workOrders: Pick<
        WorkOrderService,
        "applyInvoiceWorkflowPointer" | "applyInvoiceWorkflowTransition"
      >;
      notifications?: NotificationService;
      atomicPersistence?: AtomicPersistenceService;
    },
  ) {
    this.repositories = repositories;
    this.dependencies = dependencies;
  }

  async getById(invoiceId: EntityId): Promise<ServiceResult<Invoice>> {
    return this.getInvoiceById(invoiceId);
  }

  async getInvoiceById(invoiceId: EntityId): Promise<ServiceResult<Invoice>> {
    const invoice = await this.repositories.clientInvoices.getById(invoiceId);
    if (!invoice || invoice.isDeleted) {
      return serviceFail(notFoundError("Invoice could not be found."));
    }

    return serviceOk(invoice);
  }

  async listByWorkOrderId(
    workOrderId: EntityId,
  ): Promise<ServiceResult<Invoice[]>> {
    return this.getInvoicesForWorkOrder(workOrderId);
  }

  async getInvoicesForWorkOrder(
    workOrderId: EntityId,
  ): Promise<ServiceResult<Invoice[]>> {
    const invoices = await this.repositories.clientInvoices.listByWorkOrderId(workOrderId);
    return serviceOk(invoices.items);
  }

  async listFinanceQueue(
    input: ListFinanceQueueInput = {},
  ): Promise<ServiceResult<Invoice[]>> {
    const statuses = input.statuses?.length ? new Set(input.statuses) : null;
    const invoices = await this.repositories.clientInvoices.listFinanceQueue({
      limit: statuses ? undefined : input.limit,
    });
    const filtered = statuses
      ? invoices.items.filter((invoice) => statuses.has(invoice.status))
      : invoices.items.filter((invoice) => invoice.status !== "void");

    const ordered = [...filtered].sort((left, right) => {
      const priority = compareFinanceQueuePriority(left.status, right.status);
      if (priority !== 0) {
        return priority;
      }

      return Date.parse(left.dueDate) - Date.parse(right.dueDate);
    });

    return serviceOk(input.limit ? ordered.slice(0, input.limit) : ordered);
  }

  async create(input: CreateInvoiceServiceInput): Promise<ServiceResult<Invoice>> {
    return this.createInvoiceFromWorkOrder(input);
  }

  async createInvoiceFromWorkOrder(
    input: CreateInvoiceServiceInput,
  ): Promise<ServiceResult<Invoice>> {
    const logger = createServiceLogger("invoice.create", input);
    const workOrder = await this.repositories.workOrders.getById(input.workOrderId);
    if (!workOrder || workOrder.isDeleted) {
      return serviceFail(notFoundError("Work order could not be found."));
    }

    if (!isWorkOrderEligibleForInvoiceCreation(workOrder.lifecycleStatus)) {
      return serviceFail(
        validationError(
          "Invoices can only be created for work_completed, completion_review, or ready_for_invoicing work orders.",
        ),
      );
    }

    const existingInvoices = await this.repositories.clientInvoices.listByWorkOrderId(
      workOrder.id,
    );
    const eligibility = buildInvoiceCreationEligibility({
      workOrderStatus: workOrder.lifecycleStatus,
      hasActiveInvoice: existingInvoices.items.some(
        (invoice) => invoice.status !== "void",
      ),
    });
    if (!eligibility.eligible) {
      return serviceFail(validationError(eligibility.reason ?? "Invoice cannot be created."));
    }

    const normalized = validateDraftInput(input, false);
    if (!normalized.ok) {
      return normalized;
    }

    const id = this.repositories.clientInvoices.newId();
    const invoice: Invoice = {
      id,
      ...createAuditFields(input),
      workOrderId: workOrder.id,
      clientOrganizationId: workOrder.clientOrganizationId,
      locationId: workOrder.locationId,
      invoiceNumber: `INV-${id.slice(0, 8).toUpperCase()}`,
      lineItems: normalized.value.lineItems,
      subtotal: normalized.value.subtotal,
      taxAmount: normalized.value.taxAmount,
      totalAmount: normalized.value.totalAmount,
      currency: input.currency,
      status: "draft",
      issuedDate: null,
      dueDate: normalized.value.dueDate,
      sentAt: null,
      viewedAt: null,
      paidAt: null,
      voidedAt: null,
      paymentReference: null,
      notes: normalized.value.notes,
      qboInvoiceId: null,
      qboSyncStatus: null,
      workOrderSnapshot: {
        id: workOrder.id,
        name: workOrder.workOrderNumber,
      },
      clientSnapshot: workOrder.clientSnapshot,
      locationSnapshot: {
        id: workOrder.locationSnapshot.id,
        name: workOrder.locationSnapshot.name,
      },
    };

    const pointerUpdate = this.dependencies.atomicPersistence
      ? await this.dependencies.atomicPersistence.runInTransaction(async (atomic) => {
          atomic.create("clientInvoices", invoice);
          return this.dependencies.workOrders.applyInvoiceWorkflowPointer({
            ...input,
            atomic,
            source: "invoice_workflow",
            workOrderId: workOrder.id,
            currentInvoiceId: invoice.id,
          });
        })
      : await (async () => {
          await this.repositories.clientInvoices.create(invoice);
          return this.dependencies.workOrders.applyInvoiceWorkflowPointer({
            ...input,
            source: "invoice_workflow",
            workOrderId: workOrder.id,
            currentInvoiceId: invoice.id,
          });
        })();
    if (!pointerUpdate.ok) {
      return pointerUpdate;
    }
    logger.info("use_case.completed", {
      action: "invoice.created",
      resource: {
        type: "invoice",
        id: invoice.id,
        label: invoice.invoiceNumber,
      },
      workOrderId: workOrder.id,
    });

    await this.dependencies.notifications?.captureOperationalEvent({
      ...input,
      eventType: "invoice_created",
      entityType: "invoice",
      entityId: invoice.id,
      workOrder,
      invoice,
      targetPath: "/finance",
    });

    return serviceOk(invoice);
  }

  async updateDraft(
    input: UpdateInvoiceDraftInput,
  ): Promise<ServiceResult<Invoice>> {
    return this.updateInvoiceDraft(input);
  }

  async updateInvoiceDraft(
    input: UpdateInvoiceDraftInput,
  ): Promise<ServiceResult<Invoice>> {
    const logger = createServiceLogger("invoice.update_draft", input);
    const workOrder = await this.getMutableWorkOrderForInvoice(
      input.workOrderId,
      input.invoiceId,
    );
    if (!workOrder.ok) {
      return workOrder;
    }

    const invoice = await this.getInvoiceForWorkOrder(
      input.workOrderId,
      input.invoiceId,
    );
    if (!invoice.ok) {
      return invoice;
    }

    if (invoice.value.status !== "draft") {
      return serviceFail(validationError("Only draft invoices can be edited."));
    }

    const normalized = validateDraftInput(input, true);
    if (!normalized.ok) {
      return normalized;
    }

    const updated = touchAuditFields(
      {
        ...invoice.value,
        dueDate: normalized.value.dueDate,
        lineItems: normalized.value.lineItems,
        subtotal: normalized.value.subtotal,
        taxAmount: normalized.value.taxAmount,
        totalAmount: normalized.value.totalAmount,
        currency: input.currency,
        notes: normalized.value.notes,
      },
      input,
    );

    await this.repositories.clientInvoices.save(updated);
    logger.info("use_case.completed", {
      action: "invoice.updated",
      resource: {
        type: "invoice",
        id: updated.id,
        label: updated.invoiceNumber,
      },
      workOrderId: workOrder.value.id,
    });

    return serviceOk(updated);
  }

  async transition(
    input: TransitionInvoiceInput,
  ): Promise<ServiceResult<Invoice>> {
    const logger = createServiceLogger("invoice.transition", input);
    const invoice = await this.getInvoiceForWorkOrder(
      input.workOrderId,
      input.invoiceId,
    );
    if (!invoice.ok) {
      return invoice;
    }

    const workOrder = await this.getMutableWorkOrderForInvoice(
      input.workOrderId,
      input.invoiceId,
    );
    if (!workOrder.ok) {
      return workOrder;
    }

    if (isTerminalInvoiceStatus(invoice.value.status)) {
      return serviceFail(
        invalidTransitionError(
          `Invoice status ${invoice.value.status} is terminal.`,
        ),
      );
    }

    if (!canInvoiceTransition(invoice.value.status, input.toStatus)) {
      return serviceFail(
        invalidTransitionError(
          `Invoice cannot transition from ${invoice.value.status} to ${input.toStatus}.`,
        ),
      );
    }

    const timestamp = input.now ?? new Date().toISOString();
    const prerequisiteValidation = validateInvoiceTransitionPrerequisites(
      workOrder.value,
      invoice.value,
      input.toStatus,
      timestamp,
      input,
    );
    if (!prerequisiteValidation.ok) {
      return prerequisiteValidation;
    }

    const transitioned = touchAuditFields(
      applyStatusMutation(invoice.value, input, timestamp),
      { ...input, now: timestamp },
    );

    const persistTransition = async (atomic?: AtomicPersistenceContext) => {
      if (atomic) {
        atomic.save("clientInvoices", transitioned);
      } else {
        await this.repositories.clientInvoices.save(transitioned);
      }
      const workOrderReaction = await this.applyWorkOrderReaction(
        workOrder.value,
        invoice.value,
        transitioned,
        { ...input, atomic, now: timestamp },
      );
      if (!workOrderReaction.ok) {
        return workOrderReaction;
      }
      if (input.toStatus === "sent" || input.toStatus === "paid") {
        await this.dependencies.domainEvents.record({
          ...input,
          atomic,
          now: timestamp,
          workOrderId: transitioned.workOrderId,
          type: input.toStatus === "sent" ? "invoice_sent" : "payment_recorded",
          visibility: input.toStatus === "sent" ? "client" : "finance",
          lifecycleStatus: workOrder.value.lifecycleStatus,
          entity: {
            entityType: "invoice",
            entityId: transitioned.id,
            label: transitioned.invoiceNumber,
          },
          summary: buildInvoiceActivityMessage(invoice.value, input.toStatus),
          payload:
            input.toStatus === "sent"
              ? {
                  invoiceId: transitioned.id,
                  invoiceStatus: transitioned.status,
                  totalAmount: transitioned.totalAmount,
                }
              : {
                  invoiceId: transitioned.id,
                  invoiceStatus: transitioned.status,
                  paymentReference: transitioned.paymentReference ?? null,
                },
        });
      }
      return serviceOk(true);
    };

    const persisted = this.dependencies.atomicPersistence
      ? await this.dependencies.atomicPersistence.runInTransaction((atomic) =>
          persistTransition(atomic),
        )
      : await persistTransition();
    if (!persisted.ok) {
      return persisted;
    }
    logger.info("use_case.completed", {
      action: "invoice.status_changed",
      resource: {
        type: "invoice",
        id: transitioned.id,
        label: transitioned.invoiceNumber,
      },
      fromStatus: invoice.value.status,
      toStatus: input.toStatus,
    });

    if (input.toStatus === "sent" || input.toStatus === "overdue") {
      await this.dependencies.notifications?.captureOperationalEvent({
        ...input,
        now: timestamp,
        eventType: input.toStatus === "sent" ? "invoice_sent" : "invoice_overdue",
        entityType: "invoice",
        entityId: transitioned.id,
        workOrder: workOrder.value,
        invoice: transitioned,
        fromStatus: invoice.value.status,
        toStatus: input.toStatus,
        targetPath: "/finance",
      });
    }

    return serviceOk(transitioned);
  }

  async sendInvoice(input: SendInvoiceInput): Promise<ServiceResult<Invoice>> {
    const payload = sendInvoiceSchema.safeParse(input);
    if (!payload.success) {
      return serviceFail(validationError(payload.error.issues[0]?.message ?? "Invalid send invoice payload."));
    }

    return this.transition({
      ...input,
      now: payload.data.sentAt ?? input.now,
      workOrderId: payload.data.workOrderId,
      invoiceId: payload.data.invoiceId,
      issuedDate: payload.data.issuedDate ?? undefined,
      sentAt: payload.data.sentAt ?? undefined,
      toStatus: "sent",
    });
  }

  async markInvoiceViewed(
    input: MarkInvoiceViewedInput,
  ): Promise<ServiceResult<Invoice>> {
    const payload = markInvoiceViewedSchema.safeParse(input);
    if (!payload.success) {
      return serviceFail(validationError(payload.error.issues[0]?.message ?? "Invalid mark invoice viewed payload."));
    }

    return this.transition({
      ...input,
      now: payload.data.viewedAt ?? input.now,
      workOrderId: payload.data.workOrderId,
      invoiceId: payload.data.invoiceId,
      viewedAt: payload.data.viewedAt ?? undefined,
      toStatus: "viewed",
    });
  }

  async markInvoiceOverdue(
    input: MarkInvoiceOverdueInput,
  ): Promise<ServiceResult<Invoice>> {
    return this.transition({ ...input, toStatus: "overdue" });
  }

  async markInvoicePaid(
    input: MarkInvoicePaidInput,
  ): Promise<ServiceResult<Invoice>> {
    const payload = markInvoicePaidSchema.safeParse(input);
    if (!payload.success) {
      return serviceFail(validationError(payload.error.issues[0]?.message ?? "Invalid mark invoice paid payload."));
    }

    return this.transition({
      ...input,
      now: payload.data.paidAt ?? input.now,
      workOrderId: payload.data.workOrderId,
      invoiceId: payload.data.invoiceId,
      paidAt: payload.data.paidAt ?? undefined,
      paymentReference: payload.data.paymentReference ?? undefined,
      toStatus: "paid",
    });
  }

  async voidInvoice(input: VoidInvoiceInput): Promise<ServiceResult<Invoice>> {
    const payload = voidInvoiceSchema.safeParse(input);
    if (!payload.success) {
      return serviceFail(validationError(payload.error.issues[0]?.message ?? "Invalid void invoice payload."));
    }

    return this.transition({
      ...input,
      now: payload.data.voidedAt ?? input.now,
      workOrderId: payload.data.workOrderId,
      invoiceId: payload.data.invoiceId,
      voidedAt: payload.data.voidedAt ?? undefined,
      toStatus: "void",
    });
  }

  async prepareInvoiceForAccountingSync(
    invoiceId: EntityId,
  ): Promise<ServiceResult<AccountingSyncPayload>> {
    const invoice = await this.getInvoiceById(invoiceId);
    if (!invoice.ok) {
      return invoice;
    }

    return serviceOk({
      invoiceId: invoice.value.id,
      workOrderId: invoice.value.workOrderId,
      clientOrganizationId: invoice.value.clientOrganizationId,
      locationId: invoice.value.locationId,
      invoiceNumber: invoice.value.invoiceNumber,
      status: invoice.value.status,
      currency: invoice.value.currency,
      lineItems: invoice.value.lineItems,
      subtotal: invoice.value.subtotal ?? 0,
      taxAmount: invoice.value.taxAmount,
      totalAmount: invoice.value.totalAmount,
      issuedDate: invoice.value.issuedDate,
      dueDate: invoice.value.dueDate,
      sentAt: invoice.value.sentAt,
      viewedAt: invoice.value.viewedAt,
      paidAt: invoice.value.paidAt,
      paymentReference: invoice.value.paymentReference,
      notes: invoice.value.notes,
      qboInvoiceId: invoice.value.qboInvoiceId,
      qboSyncStatus: invoice.value.qboSyncStatus,
    });
  }

  async markInvoiceSyncPending(
    input: InvoiceSyncMutationInput,
  ): Promise<ServiceResult<Invoice>> {
    return this.updateInvoiceSyncState(input, "pending");
  }

  async markInvoiceSyncSuccess(
    input: InvoiceSyncSuccessInput,
  ): Promise<ServiceResult<Invoice>> {
    const invoice = await this.getInvoiceById(input.invoiceId);
    if (!invoice.ok) {
      return invoice;
    }

    const updated = touchAuditFields(
      {
        ...invoice.value,
        qboInvoiceId: input.qboInvoiceId,
        qboSyncStatus: "synced" as const,
      },
      input,
    );
    await this.repositories.clientInvoices.save(updated);
    return serviceOk(updated);
  }

  async markInvoiceSyncFailed(
    input: InvoiceSyncMutationInput,
  ): Promise<ServiceResult<Invoice>> {
    return this.updateInvoiceSyncState(input, "failed");
  }

  private async updateInvoiceSyncState(
    input: InvoiceSyncMutationInput,
    qboSyncStatus: QboSyncStatus,
  ): Promise<ServiceResult<Invoice>> {
    const invoice = await this.getInvoiceById(input.invoiceId);
    if (!invoice.ok) {
      return invoice;
    }

    const updated = touchAuditFields(
      {
        ...invoice.value,
        qboSyncStatus,
      },
      input,
    );
    await this.repositories.clientInvoices.save(updated);
    return serviceOk(updated);
  }

  private async getInvoiceForWorkOrder(
    workOrderId: EntityId,
    invoiceId: EntityId,
  ): Promise<ServiceResult<Invoice>> {
    const invoice = await this.repositories.clientInvoices.getById(invoiceId);
    if (!invoice || invoice.isDeleted || invoice.workOrderId !== workOrderId) {
      return serviceFail(
        notFoundError("Invoice could not be found for this work order."),
      );
    }

    return serviceOk(invoice);
  }

  private async getMutableWorkOrderForInvoice(
    workOrderId: EntityId,
    invoiceId: EntityId,
  ): Promise<ServiceResult<WorkOrder>> {
    const workOrder = await this.repositories.workOrders.getById(workOrderId);
    if (!workOrder || workOrder.isDeleted) {
      return serviceFail(notFoundError("Work order could not be found."));
    }

    if (workOrder.currentInvoiceId !== invoiceId) {
      return serviceFail(
        validationError("Only the current invoice can be changed by finance actions."),
      );
    }

    return serviceOk(workOrder);
  }

  private async applyWorkOrderReaction(
    workOrder: WorkOrder,
    previousInvoice: Invoice,
    invoice: Invoice,
    input: TransitionInvoiceInput & { now: string },
  ): Promise<ServiceResult<true>> {
    if (
      invoice.status === "sent" &&
      (
        workOrder.lifecycleStatus === "work_completed" ||
        workOrder.lifecycleStatus === "completion_review" ||
        workOrder.lifecycleStatus === "ready_for_invoicing"
      )
    ) {
      const transition = await this.dependencies.workOrders.applyInvoiceWorkflowTransition({
        ...input,
        source: "invoice_workflow",
        workOrderId: workOrder.id,
        toStatus: "invoiced",
        invoiceSentAt: invoice.sentAt ?? input.now,
        invoiceId: previousInvoice.id,
        invoiceNumber: previousInvoice.invoiceNumber,
      });
      if (!transition.ok) {
        return transition;
      }
    }

    if (invoice.status === "paid" && workOrder.lifecycleStatus === "invoiced") {
      const transition = await this.dependencies.workOrders.applyInvoiceWorkflowTransition({
        ...input,
        source: "invoice_workflow",
        workOrderId: workOrder.id,
        toStatus: "paid",
        paidAt: invoice.paidAt ?? input.now,
        invoiceId: previousInvoice.id,
        invoiceNumber: previousInvoice.invoiceNumber,
      });
      if (!transition.ok) {
        return transition;
      }
    }

    if (invoice.status === "void") {
      if (workOrder.lifecycleStatus === "invoiced") {
        const transition = await this.dependencies.workOrders.applyInvoiceWorkflowTransition({
          ...input,
          source: "invoice_workflow",
          workOrderId: workOrder.id,
          toStatus: "ready_for_invoicing",
          currentInvoiceId: null,
          invoiceId: previousInvoice.id,
          invoiceNumber: previousInvoice.invoiceNumber,
        });
        if (!transition.ok) {
          return transition;
        }
      } else {
        const pointerUpdate = await this.dependencies.workOrders.applyInvoiceWorkflowPointer({
          ...input,
          source: "invoice_workflow",
          workOrderId: workOrder.id,
          currentInvoiceId: null,
        });
        if (!pointerUpdate.ok) {
          return pointerUpdate;
        }
      }
    }

    return serviceOk(true);
  }
}

function validateDraftInput(
  input: CreateInvoiceServiceInput | UpdateInvoiceDraftInput,
  requireInvoiceId: boolean,
): ServiceResult<{
  dueDate: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
}> {
  const schema = requireInvoiceId
    ? updateInvoiceDraftSchema
    : createInvoiceFromWorkOrderSchema;
  const parsed = schema.safeParse({
    workOrderId: input.workOrderId,
    invoiceId: "invoiceId" in input ? input.invoiceId : undefined,
    dueDate: input.dueDate,
    currency: input.currency,
    lineItems: input.lineItems,
    subtotal: input.subtotal,
    taxAmount: input.taxAmount,
    totalAmount: input.totalAmount,
    notes: input.notes,
  });

  if (!parsed.success) {
    return serviceFail(validationError(parsed.error.issues[0]?.message ?? "Invalid invoice payload."));
  }

  return serviceOk({
    dueDate: parsed.data.dueDate,
    lineItems: parsed.data.lineItems,
    subtotal: parsed.data.subtotal
      ?? roundMoney(parsed.data.lineItems.reduce((sum, lineItem) => sum + lineItem.lineTotal, 0)),
    taxAmount: parsed.data.taxAmount,
    totalAmount: parsed.data.totalAmount
      ?? roundMoney(
        (parsed.data.subtotal
          ?? parsed.data.lineItems.reduce((sum, lineItem) => sum + lineItem.lineTotal, 0)) +
          parsed.data.taxAmount,
      ),
    notes: parsed.data.notes ?? null,
  });
}

function applyStatusMutation(
  invoice: Invoice,
  input: TransitionInvoiceInput,
  timestamp: string,
): Invoice {
  const issuedDate = input.issuedDate ?? timestamp;
  const sentAt = input.sentAt ?? timestamp;
  const viewedAt = input.viewedAt ?? timestamp;
  const paidAt = input.paidAt ?? timestamp;
  const voidedAt = input.voidedAt ?? timestamp;

  return {
    ...invoice,
    status: input.toStatus,
    issuedDate:
      input.toStatus === "sent"
        ? invoice.issuedDate ?? issuedDate
        : invoice.issuedDate,
    sentAt:
      input.toStatus === "sent"
        ? invoice.sentAt ?? sentAt
        : invoice.sentAt,
    viewedAt:
      input.toStatus === "viewed"
        ? invoice.viewedAt ?? viewedAt
        : invoice.viewedAt,
    paidAt:
      input.toStatus === "paid"
        ? invoice.paidAt ?? paidAt
        : invoice.paidAt,
    voidedAt:
      input.toStatus === "void"
        ? invoice.voidedAt ?? voidedAt
        : invoice.voidedAt,
    paymentReference:
      input.toStatus === "paid"
        ? input.paymentReference ?? invoice.paymentReference
        : invoice.paymentReference,
    qboSyncStatus:
      input.toStatus === "sent" || input.toStatus === "paid" || input.toStatus === "void"
        ? "pending"
        : invoice.qboSyncStatus,
  };
}

function validateInvoiceTransitionPrerequisites(
  workOrder: {
    lifecycleStatus: WorkOrderStatus;
    currentInvoiceId: EntityId | null;
  },
  invoice: Invoice,
  toStatus: InvoiceStatus,
  now: string,
  transitionInput?: Pick<TransitionInvoiceInput, "issuedDate">,
): ServiceResult<true> {
  if (workOrder.currentInvoiceId !== invoice.id) {
    return serviceFail(
      validationError("Only the current invoice can be transitioned."),
    );
  }

  if (toStatus === "sent") {
    if (!isWorkOrderEligibleForInvoiceCreation(workOrder.lifecycleStatus)) {
      return serviceFail(
        validationError(
          "Invoices can only be sent when the work order is work_completed, completion_review, or ready_for_invoicing.",
        ),
      );
    }

    if (!invoice.lineItems.length) {
      return serviceFail(
        validationError("Invoice must have at least one line item before it can be sent."),
      );
    }

    if (
      (invoice.subtotal ?? 0) <= 0 ||
      roundMoney((invoice.subtotal ?? 0) + invoice.taxAmount) !== invoice.totalAmount
    ) {
      return serviceFail(validationError("Invoice totals are inconsistent and cannot be sent."));
    }

    const issuedAt = Date.parse(transitionInput?.issuedDate ?? invoice.issuedDate ?? now);
    const dueAt = Date.parse(invoice.dueDate);
    if (!Number.isFinite(dueAt) || dueAt < issuedAt) {
      return serviceFail(
        validationError("Invoice due date cannot be earlier than the issued date."),
      );
    }
  }

  if (toStatus === "viewed" && workOrder.lifecycleStatus !== "invoiced") {
    return serviceFail(
      validationError("Invoices can only be marked viewed after the work order is invoiced."),
    );
  }

  if (toStatus === "paid" && workOrder.lifecycleStatus !== "invoiced") {
    return serviceFail(
      validationError("Invoices can only be marked paid after the work order is invoiced."),
    );
  }

  if (toStatus === "overdue") {
    if (workOrder.lifecycleStatus !== "invoiced") {
      return serviceFail(
        validationError("Invoices can only be marked overdue after the work order is invoiced."),
      );
    }

    if (Date.parse(invoice.dueDate) > Date.parse(now)) {
      return serviceFail(
        validationError("Invoices can only be marked overdue after the due date has passed."),
      );
    }
  }

  if (toStatus === "void" && invoice.status === "paid") {
    return serviceFail(
      invalidTransitionError("Paid invoices cannot be voided."),
    );
  }

  return serviceOk(true);
}

function compareFinanceQueuePriority(
  left: InvoiceStatus,
  right: InvoiceStatus,
): number {
  return financeQueuePriority(mapInvoiceStatusToQueueState(left))
    - financeQueuePriority(mapInvoiceStatusToQueueState(right));
}

function buildInvoiceActivityMessage(
  invoice: Invoice,
  toStatus: InvoiceStatus,
): string {
  switch (toStatus) {
    case "sent":
      return `Sent invoice ${invoice.invoiceNumber}.`;
    case "viewed":
      return `Marked invoice ${invoice.invoiceNumber} as viewed.`;
    case "paid":
      return `Marked invoice ${invoice.invoiceNumber} as paid.`;
    case "overdue":
      return `Marked invoice ${invoice.invoiceNumber} as overdue.`;
    case "void":
      return `Voided invoice ${invoice.invoiceNumber}.`;
    default:
      return `Changed invoice status from ${invoice.status} to ${toStatus}.`;
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function mapInvoiceStatusToQueueState(
  status: InvoiceStatus,
): "draft" | "sent" | "overdue" | "paid" {
  switch (status) {
    case "viewed":
      return "sent";
    case "overdue":
      return "overdue";
    case "paid":
      return "paid";
    case "draft":
      return "draft";
    case "sent":
      return "sent";
    default:
      return "paid";
  }
}
