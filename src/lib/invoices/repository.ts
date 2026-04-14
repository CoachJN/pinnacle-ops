import type { Invoice, InvoiceFormInput, InvoiceStatus } from "../../types/invoice.ts";
import type { InternalUserRole } from "../../types/permissions.ts";
import {
  addWorkOrderActivity,
  getWorkOrderById,
  setCurrentInvoiceForWorkOrder,
  transitionWorkOrderStatus,
} from "../work-orders/repository.ts";
import type { WorkOrderRepositoryActor } from "../work-orders/repository.ts";
import {
  calculateInvoiceSubtotal,
  calculateInvoiceTotal,
} from "./money.ts";
import { recordWorkflowEvent } from "../workflow/internal-events.ts";
import { SYSTEM_WORKFLOW_ACTOR } from "../workflow/system-actor.ts";

export interface InvoiceRepositoryActor {
  name: string;
  role: InternalUserRole;
}

const initialInvoices: Invoice[] = [
  invoiceSeed({
    id: "inv-1005",
    workOrderId: "wo-1005",
    invoiceNumber: "INV-1005",
    status: "paid",
    issueDate: "2026-04-02T15:00:00.000Z",
    dueDate: "2026-04-16",
    paidDate: "2026-04-02T16:00:00.000Z",
    lineItems: [
      line("inv-1005-line-1", "Door track adjustment and testing", 1, 420),
    ],
    taxAmount: 54.6,
    paymentReference: "EFT-1005",
    internalFinanceNotes: "Closed after payment confirmation.",
    createdAt: "2026-04-02T15:00:00.000Z",
    updatedAt: "2026-04-02T16:00:00.000Z",
  }),
  invoiceSeed({
    id: "inv-1013",
    workOrderId: "wo-1013",
    invoiceNumber: "INV-1013",
    status: "draft",
    issueDate: null,
    dueDate: "2026-04-24",
    paidDate: null,
    lineItems: [
      line("inv-1013-line-1", "Replacement keypad", 1, 325),
      line("inv-1013-line-2", "Installation labor", 2, 95),
    ],
    taxAmount: 66.95,
    internalFinanceNotes: "Draft awaiting final review.",
    createdAt: "2026-04-10T17:15:00.000Z",
    updatedAt: "2026-04-10T17:15:00.000Z",
  }),
  invoiceSeed({
    id: "inv-1014",
    workOrderId: "wo-1014",
    invoiceNumber: "INV-1014",
    status: "issued",
    issueDate: "2026-04-09T19:00:00.000Z",
    dueDate: "2026-04-23",
    paidDate: null,
    lineItems: [line("inv-1014-line-1", "Suite lock repair", 1, 275)],
    taxAmount: 35.75,
    createdAt: "2026-04-09T18:45:00.000Z",
    updatedAt: "2026-04-09T19:00:00.000Z",
  }),
  invoiceSeed({
    id: "inv-1015",
    workOrderId: "wo-1015",
    invoiceNumber: "INV-1015",
    status: "overdue",
    issueDate: "2026-03-22T13:00:00.000Z",
    dueDate: "2026-04-05",
    paidDate: null,
    lineItems: [
      line("inv-1015-line-1", "Emergency ceiling tile materials", 14, 18),
      line("inv-1015-line-2", "After-hours replacement labor", 3, 125),
    ],
    taxAmount: 81.51,
    internalFinanceNotes: "Manual overdue status recorded for follow-up.",
    createdAt: "2026-03-22T13:00:00.000Z",
    updatedAt: "2026-04-06T09:00:00.000Z",
  }),
  invoiceSeed({
    id: "inv-1016",
    workOrderId: "wo-1016",
    invoiceNumber: "INV-1016",
    status: "paid",
    issueDate: "2026-04-05T14:00:00.000Z",
    dueDate: "2026-04-19",
    paidDate: "2026-04-08T16:15:00.000Z",
    lineItems: [
      line("inv-1016-line-1", "Exhaust fan service", 1, 510),
      line("inv-1016-line-2", "Replacement belt", 1, 42),
    ],
    taxAmount: 71.76,
    paymentReference: "ACH-0411",
    createdAt: "2026-04-05T14:00:00.000Z",
    updatedAt: "2026-04-08T16:15:00.000Z",
  }),
  invoiceSeed({
    id: "inv-1017a",
    workOrderId: "wo-1017",
    invoiceNumber: "INV-1017",
    status: "void",
    issueDate: "2026-04-09T15:00:00.000Z",
    dueDate: "2026-04-23",
    paidDate: null,
    lineItems: [line("inv-1017a-line-1", "Tenant signage removal", 3, 180)],
    taxAmount: 70.2,
    internalFinanceNotes: "Voided because quantity was incorrect.",
    createdAt: "2026-04-09T15:00:00.000Z",
    updatedAt: "2026-04-10T18:00:00.000Z",
  }),
  invoiceSeed({
    id: "inv-1017b",
    workOrderId: "wo-1017",
    invoiceNumber: "INV-1018",
    status: "draft",
    issueDate: null,
    dueDate: "2026-04-25",
    paidDate: null,
    lineItems: [line("inv-1017b-line-1", "Tenant signage removal", 2, 180)],
    taxAmount: 46.8,
    internalFinanceNotes: "Replacement draft after voided invoice.",
    createdAt: "2026-04-10T18:00:00.000Z",
    updatedAt: "2026-04-10T18:00:00.000Z",
  }),
];

const store = globalThis as typeof globalThis & {
  __pinnaclePhaseSixInvoices?: Invoice[];
  __pinnaclePhaseSixInvoiceSequence?: number;
};

const invoices = store.__pinnaclePhaseSixInvoices ?? initialInvoices;
store.__pinnaclePhaseSixInvoices = invoices;
store.__pinnaclePhaseSixInvoiceSequence =
  store.__pinnaclePhaseSixInvoiceSequence ?? 2000;

export async function listInvoices(): Promise<Invoice[]> {
  return [...invoices].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

export async function listInvoicesForWorkOrder(
  workOrderId: string,
): Promise<Invoice[]> {
  return invoices
    .filter((invoice) => invoice.workOrderId === workOrderId)
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function getInvoiceById(
  workOrderId: string,
  invoiceId: string,
): Promise<Invoice | null> {
  if (!workOrderId.trim() || !invoiceId.trim()) {
    return null;
  }

  return (
    invoices.find(
      (invoice) => invoice.workOrderId === workOrderId && invoice.id === invoiceId,
    ) ?? null
  );
}

export async function getCurrentInvoiceForWorkOrder(
  workOrderId: string,
): Promise<Invoice | null> {
  const workOrder = await getWorkOrderById(workOrderId);
  if (!workOrder?.currentInvoiceId) {
    return null;
  }

  return getInvoiceById(workOrderId, workOrder.currentInvoiceId);
}

export async function createInvoice(
  workOrderId: string,
  input: InvoiceFormInput,
  actor: InvoiceRepositoryActor,
): Promise<Invoice | null> {
  const workOrder = await getWorkOrderById(workOrderId);
  if (!workOrder) {
    return null;
  }

  const now = new Date().toISOString();
  const sequence = store.__pinnaclePhaseSixInvoiceSequence ?? 2000;
  store.__pinnaclePhaseSixInvoiceSequence = sequence + 1;
  const normalized = normalizeInvoiceInput(input, sequence);
  const invoice: Invoice = {
    id: `inv-${sequence}`,
    workOrderId,
    invoiceNumber: `INV-${sequence}`,
    status: "draft",
    issueDate: null,
    dueDate: normalized.dueDate,
    paidDate: null,
    subtotalAmount: normalized.subtotalAmount,
    taxAmount: normalized.taxAmount,
    totalAmount: normalized.totalAmount,
    currency: normalized.currency,
    lineItems: normalized.lineItems,
    internalFinanceNotes: normalized.internalFinanceNotes,
    paymentReference: null,
    clientBillToName: workOrder.clientName,
    locationDisplayName: workOrder.locationName,
    createdAt: now,
    updatedAt: now,
    createdBy: actor.name,
    lastUpdatedBy: actor.name,
  };

  invoices.unshift(invoice);
  await setCurrentInvoiceForWorkOrder(workOrderId, invoice.id, actor);
  await addWorkOrderActivity(workOrderId, {
    type: "invoice_draft_created",
    message: `Created invoice draft ${invoice.invoiceNumber}.`,
    actor,
  });

  return invoice;
}

export async function updateInvoiceDraft(
  workOrderId: string,
  invoiceId: string,
  input: InvoiceFormInput,
  actor: InvoiceRepositoryActor,
): Promise<Invoice | null> {
  const invoice = await getInvoiceById(workOrderId, invoiceId);
  if (!invoice) {
    return null;
  }

  const normalized = normalizeInvoiceInput(input);
  Object.assign(invoice, {
    dueDate: normalized.dueDate,
    subtotalAmount: normalized.subtotalAmount,
    taxAmount: normalized.taxAmount,
    totalAmount: normalized.totalAmount,
    currency: normalized.currency,
    lineItems: normalized.lineItems,
    internalFinanceNotes: normalized.internalFinanceNotes,
    updatedAt: new Date().toISOString(),
    lastUpdatedBy: actor.name,
  });

  await addWorkOrderActivity(workOrderId, {
    type: "invoice_updated",
    message: `Updated invoice draft ${invoice.invoiceNumber}.`,
    actor,
  });

  return invoice;
}

export async function issueInvoice(
  workOrderId: string,
  invoiceId: string,
  actor: InvoiceRepositoryActor,
): Promise<Invoice | null> {
  const invoice = await transitionInvoice(workOrderId, invoiceId, "issued", actor);
  if (!invoice) {
    return null;
  }

  invoice.issueDate = invoice.issueDate ?? new Date().toISOString();
  await addWorkOrderActivity(workOrderId, {
    type: "invoice_issued",
    message: `Issued invoice ${invoice.invoiceNumber}.`,
    actor,
  });
  await transitionWorkOrderStatus(workOrderId, "invoiced", SYSTEM_WORKFLOW_ACTOR, {
    activityMessage: `System moved work order to Invoiced after invoice ${invoice.invoiceNumber} was issued.`,
  });
  recordWorkflowEvent({
    workOrderId,
    type: "invoice_issued",
    message: `Invoice ${invoice.invoiceNumber} was issued.`,
  });

  return invoice;
}

export async function markInvoicePaid(
  workOrderId: string,
  invoiceId: string,
  paymentReference: string | null,
  actor: InvoiceRepositoryActor,
): Promise<Invoice | null> {
  const invoice = await transitionInvoice(workOrderId, invoiceId, "paid", actor);
  if (!invoice) {
    return null;
  }

  invoice.paidDate = new Date().toISOString();
  invoice.paymentReference = paymentReference;
  await addWorkOrderActivity(workOrderId, {
    type: "invoice_marked_paid",
    message: `Marked invoice ${invoice.invoiceNumber} paid.`,
    actor,
  });
  await transitionWorkOrderStatus(workOrderId, "paid", SYSTEM_WORKFLOW_ACTOR, {
    activityMessage: `System moved work order to Paid after invoice ${invoice.invoiceNumber} payment was recorded.`,
  });
  recordWorkflowEvent({
    workOrderId,
    type: "invoice_paid",
    message: `Invoice ${invoice.invoiceNumber} was marked paid.`,
  });

  return invoice;
}

export async function markInvoiceOverdue(
  workOrderId: string,
  invoiceId: string,
  actor: InvoiceRepositoryActor,
): Promise<Invoice | null> {
  const invoice = await transitionInvoice(workOrderId, invoiceId, "overdue", actor);
  if (!invoice) {
    return null;
  }

  await addWorkOrderActivity(workOrderId, {
    type: "invoice_marked_overdue",
    message: `Marked invoice ${invoice.invoiceNumber} overdue.`,
    actor,
  });
  recordWorkflowEvent({
    workOrderId,
    type: "invoice_overdue",
    message: `Invoice ${invoice.invoiceNumber} was marked overdue.`,
  });

  return invoice;
}

export async function voidInvoice(
  workOrderId: string,
  invoiceId: string,
  actor: InvoiceRepositoryActor,
): Promise<Invoice | null> {
  const invoice = await transitionInvoice(workOrderId, invoiceId, "void", actor);
  if (!invoice) {
    return null;
  }

  await setCurrentInvoiceForWorkOrder(workOrderId, null, SYSTEM_WORKFLOW_ACTOR);
  const workOrder = await getWorkOrderById(workOrderId);
  if (workOrder?.status === "invoiced") {
    await transitionWorkOrderStatus(workOrderId, "completed", SYSTEM_WORKFLOW_ACTOR, {
      activityMessage: `System returned work order to Completed after current invoice ${invoice.invoiceNumber} was voided with no replacement invoice.`,
    });
  }

  await addWorkOrderActivity(workOrderId, {
    type: "invoice_voided",
    message: `Voided invoice ${invoice.invoiceNumber}. The work order can be invoiced again.`,
    actor,
  });
  recordWorkflowEvent({
    workOrderId,
    type: "invoice_voided",
    message: `Invoice ${invoice.invoiceNumber} was voided.`,
  });

  return invoice;
}

export async function closePaidWorkOrder(
  workOrderId: string,
  actor: InvoiceRepositoryActor,
): Promise<boolean> {
  const workOrder = await transitionWorkOrderStatus(
    workOrderId,
    "closed",
    actor as WorkOrderRepositoryActor,
  );
  if (!workOrder) {
    return false;
  }

  await addWorkOrderActivity(workOrderId, {
    type: "status_changed",
    message: "Closed paid work order after finance verification.",
    actor,
  });
  recordWorkflowEvent({
    workOrderId,
    type: "work_order_closed",
    message: "Paid work order was closed.",
  });

  return true;
}

function transitionInvoice(
  workOrderId: string,
  invoiceId: string,
  status: InvoiceStatus,
  actor: InvoiceRepositoryActor,
): Promise<Invoice | null> {
  return getInvoiceById(workOrderId, invoiceId).then((invoice) => {
    if (!invoice) {
      return null;
    }

    invoice.status = status;
    invoice.updatedAt = new Date().toISOString();
    invoice.lastUpdatedBy = actor.name;
    return invoice;
  });
}

function normalizeInvoiceInput(input: InvoiceFormInput, sequence = 0) {
  const lineItems = input.lineItems.map((lineItem, index) => ({
    ...lineItem,
    id:
      lineItem.id && !lineItem.id.startsWith("line-")
        ? lineItem.id
        : `inv-${sequence || Date.now()}-line-${index + 1}`,
  }));
  const subtotalAmount = calculateInvoiceSubtotal(lineItems);
  const taxAmount = input.taxAmount;

  return {
    ...input,
    lineItems,
    subtotalAmount,
    taxAmount,
    totalAmount: calculateInvoiceTotal(subtotalAmount, taxAmount),
  };
}

function invoiceSeed(
  input: Omit<
    Invoice,
    | "subtotalAmount"
    | "totalAmount"
    | "currency"
    | "clientBillToName"
    | "locationDisplayName"
    | "createdBy"
    | "lastUpdatedBy"
    | "internalFinanceNotes"
    | "paymentReference"
  > &
    Partial<
      Pick<
        Invoice,
        | "currency"
        | "clientBillToName"
        | "locationDisplayName"
        | "createdBy"
        | "lastUpdatedBy"
        | "internalFinanceNotes"
        | "paymentReference"
      >
    >,
): Invoice {
  const subtotalAmount = calculateInvoiceSubtotal(input.lineItems);

  return {
    ...input,
    subtotalAmount,
    totalAmount: calculateInvoiceTotal(subtotalAmount, input.taxAmount),
    currency: input.currency ?? "CAD",
    internalFinanceNotes: input.internalFinanceNotes ?? null,
    paymentReference: input.paymentReference ?? null,
    createdBy: input.createdBy ?? "Finley Finance",
    lastUpdatedBy: input.lastUpdatedBy ?? "Finley Finance",
  };
}

function line(
  id: string,
  description: string,
  quantity: number,
  unitPrice: number,
) {
  return {
    id,
    description,
    quantity,
    unitPrice,
    lineTotal: quantity * unitPrice,
  };
}
