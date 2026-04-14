import "server-only";

import type {
  FirestoreRepositories,
  Invoice,
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
import type { ActivityLogService } from "./activity-log-service.ts";
import { createServiceLogger } from "./observability.ts";
import {
  canInvoiceTransition,
} from "./status-rules.ts";
import {
  createAuditFields,
  serviceFail,
  serviceOk,
  touchAuditFields,
  type ServiceAuditContext,
  type ServiceResult,
} from "./types.ts";
import type { NotificationService } from "./notification-service.ts";

export interface InvoiceService {
  getById(invoiceId: EntityId): Promise<ServiceResult<Invoice>>;
  getInvoiceById(invoiceId: EntityId): Promise<ServiceResult<Invoice>>;
  listByWorkOrderId(workOrderId: EntityId): Promise<ServiceResult<Invoice[]>>;
  getInvoicesForWorkOrder(workOrderId: EntityId): Promise<ServiceResult<Invoice[]>>;
  listFinanceQueue(input?: ListFinanceQueueInput): Promise<ServiceResult<Invoice[]>>;
  create(input: CreateInvoiceServiceInput): Promise<ServiceResult<Invoice>>;
  createInvoiceFromWorkOrder(
    input: CreateInvoiceServiceInput,
  ): Promise<ServiceResult<Invoice>>;
  updateDraft(input: UpdateInvoiceDraftInput): Promise<ServiceResult<Invoice>>;
  updateInvoiceDraft(
    input: UpdateInvoiceDraftInput,
  ): Promise<ServiceResult<Invoice>>;
  transition(input: TransitionInvoiceInput): Promise<ServiceResult<Invoice>>;
  sendInvoice(input: SendInvoiceInput): Promise<ServiceResult<Invoice>>;
  markInvoiceViewed(
    input: MarkInvoiceViewedInput,
  ): Promise<ServiceResult<Invoice>>;
  markInvoiceOverdue(
    input: MarkInvoiceOverdueInput,
  ): Promise<ServiceResult<Invoice>>;
  markInvoicePaid(input: MarkInvoicePaidInput): Promise<ServiceResult<Invoice>>;
  voidInvoice(input: VoidInvoiceInput): Promise<ServiceResult<Invoice>>;
  prepareInvoiceForAccountingSync(
    invoiceId: EntityId,
  ): Promise<ServiceResult<AccountingSyncPayload>>;
  markInvoiceSyncPending(
    input: InvoiceSyncMutationInput,
  ): Promise<ServiceResult<Invoice>>;
  markInvoiceSyncSuccess(
    input: InvoiceSyncSuccessInput,
  ): Promise<ServiceResult<Invoice>>;
  markInvoiceSyncFailed(
    input: InvoiceSyncMutationInput,
  ): Promise<ServiceResult<Invoice>>;
}

export interface ListFinanceQueueInput {
  limit?: number;
  statuses?: InvoiceStatus[];
}

export interface CreateInvoiceServiceInput extends ServiceAuditContext {
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

export interface TransitionInvoiceInput extends ServiceAuditContext {
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

export interface SendInvoiceInput extends ServiceAuditContext {
  workOrderId: EntityId;
  invoiceId: EntityId;
  issuedDate?: string;
  sentAt?: string;
}

export interface MarkInvoiceViewedInput extends ServiceAuditContext {
  workOrderId: EntityId;
  invoiceId: EntityId;
  viewedAt?: string;
}

export interface MarkInvoiceOverdueInput extends ServiceAuditContext {
  workOrderId: EntityId;
  invoiceId: EntityId;
}

export interface MarkInvoicePaidInput extends ServiceAuditContext {
  workOrderId: EntityId;
  invoiceId: EntityId;
  paidAt?: string;
  paymentReference?: string | null;
}

export interface VoidInvoiceInput extends ServiceAuditContext {
  workOrderId: EntityId;
  invoiceId: EntityId;
  voidedAt?: string;
}

export interface InvoiceSyncMutationInput extends ServiceAuditContext {
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
  repositories: Pick<FirestoreRepositories, "workOrders" | "invoices">,
  dependencies: {
    activityLogs: ActivityLogService;
    notifications?: NotificationService;
  },
): InvoiceService {
  return new FirestoreInvoiceService(repositories, dependencies);
}

class FirestoreInvoiceService implements InvoiceService {
  private readonly repositories: Pick<
    FirestoreRepositories,
    "workOrders" | "invoices"
  >;

  private readonly dependencies: {
    activityLogs: ActivityLogService;
    notifications?: NotificationService;
  };

  constructor(
    repositories: Pick<FirestoreRepositories, "workOrders" | "invoices">,
    dependencies: {
      activityLogs: ActivityLogService;
      notifications?: NotificationService;
    },
  ) {
    this.repositories = repositories;
    this.dependencies = dependencies;
  }

  async getById(invoiceId: EntityId): Promise<ServiceResult<Invoice>> {
    return this.getInvoiceById(invoiceId);
  }

  async getInvoiceById(invoiceId: EntityId): Promise<ServiceResult<Invoice>> {
    const invoice = await this.repositories.invoices.getById(invoiceId);
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
    const invoices = await this.repositories.invoices.listByWorkOrderId(workOrderId);
    return serviceOk(invoices.items);
  }

  async listFinanceQueue(
    input: ListFinanceQueueInput = {},
  ): Promise<ServiceResult<Invoice[]>> {
    const statuses = input.statuses?.length ? new Set(input.statuses) : null;
    const invoices = await this.repositories.invoices.listFinanceQueue({
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

    if (!isWorkOrderEligibleForInvoiceCreation(workOrder.status)) {
      return serviceFail(
        validationError(
          "Invoices can only be created for completed or ready for invoicing work orders.",
        ),
      );
    }

    const existingInvoices = await this.repositories.invoices.listByWorkOrderId(
      workOrder.id,
    );
    const eligibility = buildInvoiceCreationEligibility({
      workOrderStatus: workOrder.status,
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

    const id = this.repositories.invoices.newId();
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

    await this.repositories.invoices.create(invoice);
    await this.repositories.workOrders.save(
      touchAuditFields(
        {
          ...workOrder,
          currentInvoiceId: invoice.id,
        },
        input,
      ),
    );
    await this.dependencies.activityLogs.record({
      ...input,
      workOrderId: workOrder.id,
      action: "invoice.created",
      eventType: "invoice_created",
      message: `Created invoice draft ${invoice.invoiceNumber}.`,
      entityType: "invoice",
      entityId: invoice.id,
      entityLabel: invoice.invoiceNumber,
      visibility: "internal",
      changes: [
        { field: "status", to: invoice.status },
        { field: "totalAmount", to: invoice.totalAmount },
      ],
      metadata: {
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
      },
    });
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

    await this.repositories.invoices.save(updated);
    await this.dependencies.activityLogs.record({
      ...input,
      workOrderId: updated.workOrderId,
      action: "invoice.updated",
      eventType: "invoice_updated",
      message: `Updated invoice draft ${updated.invoiceNumber}.`,
      entityType: "invoice",
      entityId: updated.id,
      entityLabel: updated.invoiceNumber,
      visibility: "internal",
      metadata: {
        invoiceNumber: updated.invoiceNumber,
        totalAmount: updated.totalAmount,
        currency: updated.currency,
      },
    });
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

    await this.repositories.invoices.save(transitioned);
    await this.applyWorkOrderReaction(
      workOrder.value,
      invoice.value,
      transitioned,
      { ...input, now: timestamp },
    );
    await this.dependencies.activityLogs.record({
      ...input,
      now: timestamp,
      workOrderId: transitioned.workOrderId,
      action: "invoice.status_changed",
      eventType: mapInvoiceActivityEventType(input.toStatus),
      message: buildInvoiceActivityMessage(invoice.value, input.toStatus),
      entityType: "invoice",
      entityId: transitioned.id,
      entityLabel: transitioned.invoiceNumber,
      visibility: "internal",
      changes: [
        { field: "status", from: invoice.value.status, to: input.toStatus },
      ],
      metadata: {
        fromStatus: invoice.value.status,
        toStatus: input.toStatus,
      },
    });
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
    await this.repositories.invoices.save(updated);
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
    await this.repositories.invoices.save(updated);
    return serviceOk(updated);
  }

  private async getInvoiceForWorkOrder(
    workOrderId: EntityId,
    invoiceId: EntityId,
  ): Promise<ServiceResult<Invoice>> {
    const invoice = await this.repositories.invoices.getById(invoiceId);
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
  ): Promise<void> {
    if (
      invoice.status === "sent" &&
      (workOrder.status === "completed" || workOrder.status === "ready_for_invoicing")
    ) {
      const transitionedWorkOrder: WorkOrder = touchAuditFields(
        {
          ...workOrder,
          status: "invoiced",
        },
        input,
      );
      await this.repositories.workOrders.save(transitionedWorkOrder);
      await this.recordWorkOrderFinanceTransition(
        transitionedWorkOrder,
        workOrder.status,
        transitionedWorkOrder.status,
        previousInvoice.id,
        previousInvoice.invoiceNumber,
        input,
      );
    }

    if (invoice.status === "paid" && workOrder.status === "invoiced") {
      const transitionedWorkOrder: WorkOrder = touchAuditFields(
        {
          ...workOrder,
          status: "paid",
        },
        input,
      );
      await this.repositories.workOrders.save(transitionedWorkOrder);
      await this.recordWorkOrderFinanceTransition(
        transitionedWorkOrder,
        workOrder.status,
        transitionedWorkOrder.status,
        previousInvoice.id,
        previousInvoice.invoiceNumber,
        input,
      );
    }

    if (invoice.status === "void") {
      const nextStatus: WorkOrderStatus =
        workOrder.status === "invoiced" ? "ready_for_invoicing" : workOrder.status;
      const transitionedWorkOrder: WorkOrder = touchAuditFields(
        {
          ...workOrder,
          currentInvoiceId: null,
          status: nextStatus,
        },
        input,
      );
      await this.repositories.workOrders.save(transitionedWorkOrder);

      if (nextStatus !== workOrder.status) {
        await this.recordWorkOrderFinanceTransition(
          transitionedWorkOrder,
          workOrder.status,
          nextStatus,
          previousInvoice.id,
          previousInvoice.invoiceNumber,
          input,
        );
      }
    }
  }

  private async recordWorkOrderFinanceTransition(
    workOrder: WorkOrder,
    fromStatus: string,
    toStatus: string,
    invoiceId: string,
    invoiceNumber: string,
    input: TransitionInvoiceInput & { now: string },
  ): Promise<void> {
    await this.dependencies.activityLogs.record({
      ...input,
      workOrderId: workOrder.id,
      action: "work_order.status_changed",
      eventType: "work_order_status_changed",
      message: `Moved ${workOrder.workOrderNumber} from ${fromStatus} to ${toStatus} after finance updated invoice ${invoiceNumber}.`,
      entityType: "workOrder",
      entityId: workOrder.id,
      entityLabel: workOrder.workOrderNumber,
      visibility: "internal",
      changes: [
        { field: "status", from: fromStatus, to: toStatus },
      ],
      metadata: {
        fromStatus,
        toStatus,
        source: "invoice_workflow",
        invoiceId,
        invoiceNumber,
      },
    });
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
    status: string;
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
    if (!isWorkOrderEligibleForInvoiceCreation(workOrder.status)) {
      return serviceFail(
        validationError("Invoices can only be sent when the work order is completed or ready for invoicing."),
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

  if (toStatus === "viewed" && workOrder.status !== "invoiced") {
    return serviceFail(
      validationError("Invoices can only be marked viewed after the work order is invoiced."),
    );
  }

  if (toStatus === "paid" && workOrder.status !== "invoiced") {
    return serviceFail(
      validationError("Invoices can only be marked paid after the work order is invoiced."),
    );
  }

  if (toStatus === "overdue") {
    if (workOrder.status !== "invoiced") {
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

function mapInvoiceActivityEventType(toStatus: InvoiceStatus): string {
  switch (toStatus) {
    case "sent":
      return "invoice_sent";
    case "viewed":
      return "invoice_viewed";
    case "paid":
      return "invoice_paid";
    case "overdue":
      return "invoice_overdue";
    case "void":
      return "invoice_voided";
    default:
      return "invoice_status_changed";
  }
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
