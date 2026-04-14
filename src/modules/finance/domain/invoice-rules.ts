import type { InvoiceStatus } from "../../../types/invoice.ts";
import type { WorkOrderStatus } from "../../../types/work-order.ts";

export const INVOICE_CREATION_ELIGIBLE_WORK_ORDER_STATUSES = [
  "completed",
  "ready_for_invoicing",
] as const satisfies readonly WorkOrderStatus[];

export const INVOICE_TERMINAL_STATUSES = [
  "paid",
  "void",
] as const satisfies readonly InvoiceStatus[];

export const FINANCE_QUEUE_INVOICE_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "overdue",
  "paid",
] as const satisfies readonly InvoiceStatus[];

export const FINANCE_QUEUE_STATES = [
  "ready_for_invoicing",
  "draft",
  "sent",
  "overdue",
  "paid",
] as const;

export type FinanceQueueState = (typeof FINANCE_QUEUE_STATES)[number];

export const FINANCE_QUEUE_FILTERS = [
  "all",
  "attention",
  ...FINANCE_QUEUE_STATES,
] as const;

export type FinanceQueueFilter = (typeof FINANCE_QUEUE_FILTERS)[number];

export const INVOICE_DUPLICATION_POLICY = {
  kind: "single_active_invoice_per_work_order",
  description: "Only one non-void invoice may exist for a work order at a time.",
} as const;

export type InvoiceDuplicationPolicy =
  typeof INVOICE_DUPLICATION_POLICY.kind;

export interface InvoiceCreationEligibility {
  eligible: boolean;
  reason: string | null;
  duplicatePolicy: InvoiceDuplicationPolicy;
}

export function isWorkOrderEligibleForInvoiceCreation(
  status: WorkOrderStatus,
): boolean {
  return (
    INVOICE_CREATION_ELIGIBLE_WORK_ORDER_STATUSES as readonly WorkOrderStatus[]
  ).includes(status);
}

export function isTerminalInvoiceStatus(status: InvoiceStatus): boolean {
  return (INVOICE_TERMINAL_STATUSES as readonly InvoiceStatus[]).includes(status);
}

export function isInvoiceEditable(status: InvoiceStatus): boolean {
  return status === "draft";
}

export function getFinanceQueueStateForInvoiceStatus(
  status: InvoiceStatus,
): Exclude<FinanceQueueState, "ready_for_invoicing"> | null {
  switch (status) {
    case "draft":
      return "draft";
    case "sent":
    case "viewed":
      return "sent";
    case "overdue":
      return "overdue";
    case "paid":
      return "paid";
    default:
      return null;
  }
}

export function financeQueuePriority(state: FinanceQueueState): number {
  switch (state) {
    case "ready_for_invoicing":
      return 0;
    case "overdue":
      return 1;
    case "draft":
      return 2;
    case "sent":
      return 3;
    case "paid":
      return 4;
    default:
      return 5;
  }
}

export function buildInvoiceCreationEligibility(input: {
  workOrderStatus: WorkOrderStatus;
  hasActiveInvoice: boolean;
}): InvoiceCreationEligibility {
  if (!isWorkOrderEligibleForInvoiceCreation(input.workOrderStatus)) {
    return {
      eligible: false,
      reason:
        "Invoices can only be created for completed or ready for invoicing work orders.",
      duplicatePolicy: INVOICE_DUPLICATION_POLICY.kind,
    };
  }

  if (input.hasActiveInvoice) {
    return {
      eligible: false,
      reason: "This work order already has an active invoice.",
      duplicatePolicy: INVOICE_DUPLICATION_POLICY.kind,
    };
  }

  return {
    eligible: true,
    reason: null,
    duplicatePolicy: INVOICE_DUPLICATION_POLICY.kind,
  };
}
