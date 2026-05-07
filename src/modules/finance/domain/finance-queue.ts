import type { InvoiceCurrency, InvoiceStatus } from "../../../types/invoice.ts";
import type { WorkOrderStatus } from "../../../types/work-order.ts";
import {
  buildInvoiceCreationEligibility,
  financeQueuePriority,
  getFinanceQueueStateForInvoiceStatus,
  type FinanceQueueFilter,
  type FinanceQueueState,
} from "./invoice-rules.ts";

export interface FinanceQueueWorkOrderRecord {
  id: string;
  workOrderNumber: string;
  title: string;
  lifecycleStatus: WorkOrderStatus;
  priority: string | null;
  clientOrganizationId: string;
  locationId: string;
  currentInvoiceId: string | null;
  clientSnapshot?: {
    id: string;
    name: string;
  } | null;
  locationSnapshot?: {
    id: string;
    name: string;
  } | null;
  completedAt: string | null;
  updatedAt: string;
}

export interface FinanceQueueInvoiceRecord {
  id: string;
  workOrderId: string;
  invoiceNumber: string;
  status: InvoiceStatus;
  dueDate: string;
  totalAmount: number;
  currency: InvoiceCurrency;
  sentAt: string | null;
  viewedAt: string | null;
  paidAt: string | null;
  updatedAt: string;
}

export interface FinanceQueueItem {
  id: string;
  state: FinanceQueueState;
  requiresAttention: boolean;
  workOrder: FinanceQueueWorkOrderRecord;
  invoice: FinanceQueueInvoiceRecord | null;
  sortDate: string;
}

export function buildFinanceQueue(input: {
  workOrders: readonly FinanceQueueWorkOrderRecord[];
  invoices: readonly FinanceQueueInvoiceRecord[];
  now?: string;
}): FinanceQueueItem[] {
  const invoiceById = new Map(
    input.invoices.map((invoice) => [invoice.id, invoice] as const),
  );

  const items: FinanceQueueItem[] = [];

  for (const workOrder of input.workOrders) {
    const currentInvoice = workOrder.currentInvoiceId
      ? invoiceById.get(workOrder.currentInvoiceId) ?? null
      : null;
    const eligibility = buildInvoiceCreationEligibility({
      workOrderStatus: workOrder.lifecycleStatus,
      hasActiveInvoice: currentInvoice !== null && currentInvoice.status !== "void",
    });

    if (eligibility.eligible) {
      items.push({
        id: `finance-ready-${workOrder.id}`,
        state: "ready_for_invoicing",
        requiresAttention: true,
        workOrder,
        invoice: null,
        sortDate: workOrder.completedAt ?? workOrder.updatedAt,
      });
      continue;
    }

    if (!currentInvoice) {
      continue;
    }

    const state = getFinanceQueueStateForInvoiceStatus(currentInvoice.status);
    if (!state) {
      continue;
    }

    items.push({
      id: `finance-${state}-${currentInvoice.id}`,
      state,
      requiresAttention: state === "draft" || state === "overdue",
      workOrder,
      invoice: currentInvoice,
      sortDate:
        state === "paid"
          ? currentInvoice.paidAt ?? currentInvoice.updatedAt
          : currentInvoice.dueDate,
    });
  }

  return items.sort((left, right) => {
    const byPriority =
      financeQueuePriority(left.state) - financeQueuePriority(right.state);
    if (byPriority !== 0) {
      return byPriority;
    }

    return Date.parse(left.sortDate) - Date.parse(right.sortDate);
  });
}

export function filterFinanceQueueItems(
  items: readonly FinanceQueueItem[],
  filter: FinanceQueueFilter,
): FinanceQueueItem[] {
  if (filter === "all") {
    return [...items];
  }

  if (filter === "attention") {
    return items.filter((item) => item.requiresAttention);
  }

  return items.filter((item) => item.state === filter);
}
