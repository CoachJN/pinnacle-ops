import "server-only";

import type {
  FirestoreRepositories,
  Invoice,
  WorkOrder,
} from "@/server/repositories";
import type { EntityId } from "@/types/entity";
import type { InvoiceCurrency, InvoiceLineItem, InvoiceStatus } from "@/types/invoice";
import type { WorkOrderStatus } from "@/types/work-order";
import { invalidTransitionError, notFoundError, validationError } from "./errors.ts";
import type { ActivityLogService } from "./activity-log-service.ts";
import { createServiceLogger } from "./observability.ts";
import {
  canInvoiceTransition,
  isTerminalInvoiceStatus,
} from "./status-rules.ts";
import {
  createAuditFields,
  serviceFail,
  serviceOk,
  touchAuditFields,
  type ServiceAuditContext,
  type ServiceResult,
} from "./types.ts";

export interface InvoiceService {
  getById(invoiceId: EntityId): Promise<ServiceResult<Invoice>>;
  listByWorkOrderId(workOrderId: EntityId): Promise<ServiceResult<Invoice[]>>;
  listFinanceQueue(input?: ListFinanceQueueInput): Promise<ServiceResult<Invoice[]>>;
  create(input: CreateInvoiceServiceInput): Promise<ServiceResult<Invoice>>;
  updateDraft(input: UpdateInvoiceDraftInput): Promise<ServiceResult<Invoice>>;
  transition(input: TransitionInvoiceInput): Promise<ServiceResult<Invoice>>;
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
  internalFinanceNotes?: string | null;
}

export interface UpdateInvoiceDraftInput extends CreateInvoiceServiceInput {
  invoiceId: EntityId;
}

export interface TransitionInvoiceInput extends ServiceAuditContext {
  workOrderId: EntityId;
  invoiceId: EntityId;
  toStatus: InvoiceStatus;
  paymentReference?: string | null;
}

export function createInvoiceService(
  repositories: Pick<FirestoreRepositories, "workOrders" | "invoices">,
  dependencies: { activityLogs: ActivityLogService },
): InvoiceService {
  return new FirestoreInvoiceService(repositories, dependencies);
}

class FirestoreInvoiceService implements InvoiceService {
  private readonly repositories: Pick<
    FirestoreRepositories,
    "workOrders" | "invoices"
  >;

  private readonly dependencies: { activityLogs: ActivityLogService };

  constructor(
    repositories: Pick<FirestoreRepositories, "workOrders" | "invoices">,
    dependencies: { activityLogs: ActivityLogService },
  ) {
    this.repositories = repositories;
    this.dependencies = dependencies;
  }

  async getById(invoiceId: EntityId): Promise<ServiceResult<Invoice>> {
    const invoice = await this.repositories.invoices.getById(invoiceId);
    if (!invoice || invoice.isDeleted) {
      return serviceFail(notFoundError("Invoice could not be found."));
    }

    return serviceOk(invoice);
  }

  async listByWorkOrderId(
    workOrderId: EntityId,
  ): Promise<ServiceResult<Invoice[]>> {
    const invoices = await this.repositories.invoices.listByWorkOrderId(workOrderId);
    return serviceOk(invoices.items);
  }

  async listFinanceQueue(
    input: ListFinanceQueueInput = {},
  ): Promise<ServiceResult<Invoice[]>> {
    const statuses = input.statuses?.length
      ? new Set(input.statuses)
      : null;
    const invoices = await this.repositories.invoices.listFinanceQueue({
      limit: statuses ? undefined : input.limit,
    });
    const filtered = statuses
      ? invoices.items.filter((invoice) => statuses.has(invoice.status))
      : invoices.items;

    const ordered = [...filtered].sort((left, right) => {
        const priority = compareFinanceQueuePriority(left.status, right.status);
        if (priority !== 0) {
          return priority;
        }

        return Date.parse(left.dueDate) - Date.parse(right.dueDate);
      });

    return serviceOk(
      input.limit ? ordered.slice(0, input.limit) : ordered,
    );
  }

  async create(input: CreateInvoiceServiceInput): Promise<ServiceResult<Invoice>> {
    const logger = createServiceLogger("invoice.create", input);
    const workOrder = await this.repositories.workOrders.getById(input.workOrderId);
    if (!workOrder || workOrder.isDeleted) {
      return serviceFail(notFoundError("Work order could not be found."));
    }

    if (workOrder.status !== "completed") {
      return serviceFail(
        validationError("Invoices can only be created for completed work orders."),
      );
    }

    const existingInvoices = await this.repositories.invoices.listByWorkOrderId(
      workOrder.id,
    );
    const activeInvoice = existingInvoices.items.find(
      (invoice) => invoice.status !== "void",
    );
    if (activeInvoice) {
      return serviceFail(
        validationError("This work order already has an active invoice."),
      );
    }

    const normalized = normalizeInvoiceInput(input);
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
      status: "draft",
      issueDate: null,
      dueDate: normalized.value.dueDate,
      paidDate: null,
      subtotalAmount: normalized.value.subtotalAmount,
      taxAmount: normalized.value.taxAmount,
      totalAmount: normalized.value.totalAmount,
      currency: input.currency,
      lineItems: normalized.value.lineItems,
      internalFinanceNotes: input.internalFinanceNotes ?? null,
      paymentReference: null,
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

    return serviceOk(invoice);
  }

  async updateDraft(
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

    const normalized = normalizeInvoiceInput(input);
    if (!normalized.ok) {
      return normalized;
    }

    const updated = touchAuditFields(
      {
        ...invoice.value,
        dueDate: normalized.value.dueDate,
        subtotalAmount: normalized.value.subtotalAmount,
        taxAmount: normalized.value.taxAmount,
        totalAmount: normalized.value.totalAmount,
        currency: input.currency,
        lineItems: normalized.value.lineItems,
        internalFinanceNotes: input.internalFinanceNotes ?? null,
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
    );
    if (!prerequisiteValidation.ok) {
      return prerequisiteValidation;
    }

    const transitioned = touchAuditFields(
      {
        ...invoice.value,
        status: input.toStatus,
        issueDate:
          input.toStatus === "issued"
            ? invoice.value.issueDate ?? timestamp
            : invoice.value.issueDate,
        paidDate:
          input.toStatus === "paid"
            ? invoice.value.paidDate ?? timestamp
            : invoice.value.paidDate,
        paymentReference:
          input.toStatus === "paid"
            ? input.paymentReference ?? invoice.value.paymentReference
            : invoice.value.paymentReference,
      },
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

    return serviceOk(transitioned);
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
    if (invoice.status === "issued" && workOrder.status === "completed") {
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
        workOrder.status === "invoiced" ? "completed" : workOrder.status;
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

function normalizeInvoiceInput(input: {
  dueDate: string;
  lineItems: InvoiceLineItem[];
  taxAmount: number;
}): ServiceResult<{
  dueDate: string;
  lineItems: InvoiceLineItem[];
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
}> {
  if (!input.dueDate.trim()) {
    return serviceFail(validationError("Invoice due date is required."));
  }

  if (!input.lineItems.length) {
    return serviceFail(validationError("At least one invoice line item is required."));
  }

  if (!Number.isFinite(input.taxAmount) || input.taxAmount < 0) {
    return serviceFail(validationError("Invoice tax amount must be zero or greater."));
  }

  const lineItems = input.lineItems.map((lineItem) => {
    const lineTotal = lineItem.quantity * lineItem.unitPrice;
    return { ...lineItem, lineTotal };
  });

  if (
    lineItems.some(
      (lineItem) =>
        !lineItem.description.trim() ||
        !Number.isFinite(lineItem.quantity) ||
        lineItem.quantity <= 0 ||
        !Number.isFinite(lineItem.unitPrice) ||
        lineItem.unitPrice < 0,
    )
  ) {
    return serviceFail(
      validationError(
        "Invoice line items require descriptions, positive quantities, and non-negative prices.",
      ),
    );
  }

  const subtotalAmount = lineItems.reduce(
    (sum, lineItem) => sum + lineItem.lineTotal,
    0,
  );
  if (subtotalAmount <= 0) {
    return serviceFail(validationError("Invoice subtotal must be greater than zero."));
  }

  return serviceOk({
    dueDate: input.dueDate,
    lineItems,
    subtotalAmount,
    taxAmount: input.taxAmount,
    totalAmount: subtotalAmount + input.taxAmount,
  });
}

function validateInvoiceTransitionPrerequisites(
  workOrder: {
    status: string;
    currentInvoiceId: EntityId | null;
  },
  invoice: Invoice,
  toStatus: InvoiceStatus,
  now: string,
): ServiceResult<true> {
  if (workOrder.currentInvoiceId !== invoice.id) {
    return serviceFail(
      validationError("Only the current invoice can be transitioned."),
    );
  }

  if (toStatus === "issued" && workOrder.status !== "completed") {
    return serviceFail(
      validationError("Invoices can only be marked sent when the work order is completed."),
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

  return serviceOk(true);
}

function compareFinanceQueuePriority(
  left: InvoiceStatus,
  right: InvoiceStatus,
): number {
  return financeQueuePriority(left) - financeQueuePriority(right);
}

function financeQueuePriority(status: InvoiceStatus): number {
  switch (status) {
    case "overdue":
      return 0;
    case "issued":
      return 1;
    case "draft":
      return 2;
    case "paid":
      return 3;
    case "void":
      return 4;
    default:
      return 5;
  }
}

function mapInvoiceActivityEventType(toStatus: InvoiceStatus): string {
  switch (toStatus) {
    case "issued":
      return "invoice_sent";
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
    case "issued":
      return `Marked invoice ${invoice.invoiceNumber} as sent.`;
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
