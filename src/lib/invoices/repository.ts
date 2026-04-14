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
    clientOrganizationId: "client-1005",
    locationId: "loc-1005",
    invoiceNumber: "INV-1005",
    status: "paid",
    issuedDate: "2026-04-02T15:00:00.000Z",
    dueDate: "2026-04-16",
    sentAt: "2026-04-02T15:00:00.000Z",
    viewedAt: "2026-04-02T15:15:00.000Z",
    paidAt: "2026-04-02T16:00:00.000Z",
    voidedAt: null,
    lineItems: [
      line("inv-1005-line-1", "Door track adjustment and testing", 1, 420),
    ],
    taxAmount: 54.6,
    paymentReference: "EFT-1005",
    notes: "Closed after payment confirmation.",
    qboInvoiceId: null,
    qboSyncStatus: "synced",
    createdAt: "2026-04-02T15:00:00.000Z",
    updatedAt: "2026-04-02T16:00:00.000Z",
    createdByUserId: "user-finance",
    updatedByUserId: "user-finance",
  }),
  invoiceSeed({
    id: "inv-1013",
    workOrderId: "wo-1013",
    clientOrganizationId: "client-1013",
    locationId: "loc-1013",
    invoiceNumber: "INV-1013",
    status: "draft",
    issuedDate: null,
    dueDate: "2026-04-24",
    sentAt: null,
    viewedAt: null,
    paidAt: null,
    voidedAt: null,
    lineItems: [
      line("inv-1013-line-1", "Replacement keypad", 1, 325),
      line("inv-1013-line-2", "Installation labor", 2, 95),
    ],
    taxAmount: 66.95,
    notes: "Draft awaiting final review.",
    qboInvoiceId: null,
    qboSyncStatus: null,
    createdAt: "2026-04-10T17:15:00.000Z",
    updatedAt: "2026-04-10T17:15:00.000Z",
    createdByUserId: "user-finance",
    updatedByUserId: "user-finance",
  }),
  invoiceSeed({
    id: "inv-1014",
    workOrderId: "wo-1014",
    clientOrganizationId: "client-1014",
    locationId: "loc-1014",
    invoiceNumber: "INV-1014",
    status: "sent",
    issuedDate: "2026-04-09T19:00:00.000Z",
    dueDate: "2026-04-23",
    sentAt: "2026-04-09T19:00:00.000Z",
    viewedAt: null,
    paidAt: null,
    voidedAt: null,
    lineItems: [line("inv-1014-line-1", "Suite lock repair", 1, 275)],
    taxAmount: 35.75,
    notes: null,
    qboInvoiceId: null,
    qboSyncStatus: "pending",
    createdAt: "2026-04-09T18:45:00.000Z",
    updatedAt: "2026-04-09T19:00:00.000Z",
    createdByUserId: "user-finance",
    updatedByUserId: "user-finance",
  }),
  invoiceSeed({
    id: "inv-1015",
    workOrderId: "wo-1015",
    clientOrganizationId: "client-1015",
    locationId: "loc-1015",
    invoiceNumber: "INV-1015",
    status: "overdue",
    issuedDate: "2026-03-22T13:00:00.000Z",
    dueDate: "2026-04-05",
    sentAt: "2026-03-22T13:00:00.000Z",
    viewedAt: "2026-03-22T14:00:00.000Z",
    paidAt: null,
    voidedAt: null,
    lineItems: [
      line("inv-1015-line-1", "Emergency ceiling tile materials", 14, 18),
      line("inv-1015-line-2", "After-hours replacement labor", 3, 125),
    ],
    taxAmount: 81.51,
    notes: "Manual overdue status recorded for follow-up.",
    qboInvoiceId: null,
    qboSyncStatus: "failed",
    createdAt: "2026-03-22T13:00:00.000Z",
    updatedAt: "2026-04-06T09:00:00.000Z",
    createdByUserId: "user-finance",
    updatedByUserId: "user-finance",
  }),
  invoiceSeed({
    id: "inv-1016",
    workOrderId: "wo-1016",
    clientOrganizationId: "client-1016",
    locationId: "loc-1016",
    invoiceNumber: "INV-1016",
    status: "paid",
    issuedDate: "2026-04-05T14:00:00.000Z",
    dueDate: "2026-04-19",
    sentAt: "2026-04-05T14:00:00.000Z",
    viewedAt: "2026-04-05T14:10:00.000Z",
    paidAt: "2026-04-08T16:15:00.000Z",
    voidedAt: null,
    lineItems: [
      line("inv-1016-line-1", "Exhaust fan service", 1, 510),
      line("inv-1016-line-2", "Replacement belt", 1, 42),
    ],
    taxAmount: 71.76,
    paymentReference: "ACH-0411",
    notes: null,
    qboInvoiceId: null,
    qboSyncStatus: "synced",
    createdAt: "2026-04-05T14:00:00.000Z",
    updatedAt: "2026-04-08T16:15:00.000Z",
    createdByUserId: "user-finance",
    updatedByUserId: "user-finance",
  }),
  invoiceSeed({
    id: "inv-1017a",
    workOrderId: "wo-1017",
    clientOrganizationId: "client-1017",
    locationId: "loc-1017",
    invoiceNumber: "INV-1017",
    status: "void",
    issuedDate: "2026-04-09T15:00:00.000Z",
    dueDate: "2026-04-23",
    sentAt: "2026-04-09T15:00:00.000Z",
    viewedAt: null,
    paidAt: null,
    voidedAt: "2026-04-10T18:00:00.000Z",
    lineItems: [line("inv-1017a-line-1", "Tenant signage removal", 3, 180)],
    taxAmount: 70.2,
    notes: "Voided because quantity was incorrect.",
    qboInvoiceId: null,
    qboSyncStatus: "pending",
    createdAt: "2026-04-09T15:00:00.000Z",
    updatedAt: "2026-04-10T18:00:00.000Z",
    createdByUserId: "user-finance",
    updatedByUserId: "user-finance",
  }),
  invoiceSeed({
    id: "inv-1017b",
    workOrderId: "wo-1017",
    clientOrganizationId: "client-1017",
    locationId: "loc-1017",
    invoiceNumber: "INV-1018",
    status: "draft",
    issuedDate: null,
    dueDate: "2026-04-25",
    sentAt: null,
    viewedAt: null,
    paidAt: null,
    voidedAt: null,
    lineItems: [line("inv-1017b-line-1", "Tenant signage removal", 2, 180)],
    taxAmount: 46.8,
    notes: "Replacement draft after voided invoice.",
    qboInvoiceId: null,
    qboSyncStatus: null,
    createdAt: "2026-04-10T18:00:00.000Z",
    updatedAt: "2026-04-10T18:00:00.000Z",
    createdByUserId: "user-finance",
    updatedByUserId: "user-finance",
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
    clientOrganizationId: workOrder.clientId,
    locationId: workOrder.locationId,
    invoiceNumber: `INV-${sequence}`,
    status: "draft",
    issuedDate: null,
    dueDate: normalized.dueDate,
    sentAt: null,
    viewedAt: null,
    paidAt: null,
    voidedAt: null,
    subtotal: normalized.subtotal,
    taxAmount: normalized.taxAmount,
    totalAmount: normalized.totalAmount,
    currency: normalized.currency,
    lineItems: normalized.lineItems,
    notes: normalized.notes,
    paymentReference: null,
    qboInvoiceId: null,
    qboSyncStatus: null,
    clientBillToName: workOrder.clientName,
    locationDisplayName: workOrder.locationName,
    createdAt: now,
    updatedAt: now,
    createdByUserId: actor.name,
    updatedByUserId: actor.name,
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
    subtotal: normalized.subtotal,
    taxAmount: normalized.taxAmount,
    totalAmount: normalized.totalAmount,
    currency: normalized.currency,
    lineItems: normalized.lineItems,
    notes: normalized.notes,
    updatedAt: new Date().toISOString(),
    updatedByUserId: actor.name,
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
  const invoice = await transitionInvoice(workOrderId, invoiceId, "sent", actor);
  if (!invoice) {
    return null;
  }

  invoice.issuedDate = invoice.issuedDate ?? new Date().toISOString();
  invoice.sentAt = invoice.sentAt ?? new Date().toISOString();
  await addWorkOrderActivity(workOrderId, {
    type: "invoice_issued",
    message: `Sent invoice ${invoice.invoiceNumber}.`,
    actor,
  });
  await transitionWorkOrderStatus(workOrderId, "invoiced", SYSTEM_WORKFLOW_ACTOR, {
    activityMessage: `System moved work order to Invoiced after invoice ${invoice.invoiceNumber} was sent.`,
  });
  recordWorkflowEvent({
    workOrderId,
    type: "invoice_issued",
    message: `Invoice ${invoice.invoiceNumber} was sent.`,
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

  invoice.paidAt = new Date().toISOString();
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
    invoice.updatedByUserId = actor.name;
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
  const subtotal = calculateInvoiceSubtotal(lineItems);
  const taxAmount = input.taxAmount;

  return {
    ...input,
    lineItems,
    subtotal,
    taxAmount,
    totalAmount: calculateInvoiceTotal(subtotal, taxAmount),
  };
}

function invoiceSeed(
  input: Omit<
    Invoice,
    | "subtotal"
    | "totalAmount"
    | "currency"
    | "clientBillToName"
    | "locationDisplayName"
    | "createdByUserId"
    | "updatedByUserId"
    | "notes"
    | "paymentReference"
    | "qboInvoiceId"
    | "qboSyncStatus"
  > &
    Partial<
      Pick<
        Invoice,
        | "currency"
        | "clientBillToName"
        | "locationDisplayName"
        | "createdByUserId"
        | "updatedByUserId"
        | "notes"
        | "paymentReference"
        | "qboInvoiceId"
        | "qboSyncStatus"
      >
    >,
): Invoice {
  const subtotal = calculateInvoiceSubtotal(input.lineItems);

  return {
    ...input,
    subtotal,
    totalAmount: calculateInvoiceTotal(subtotal, input.taxAmount),
    currency: input.currency ?? "CAD",
    notes: input.notes ?? null,
    paymentReference: input.paymentReference ?? null,
    createdByUserId: input.createdByUserId ?? "Finley Finance",
    updatedByUserId: input.updatedByUserId ?? "Finley Finance",
    qboInvoiceId: input.qboInvoiceId ?? null,
    qboSyncStatus: input.qboSyncStatus ?? null,
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
