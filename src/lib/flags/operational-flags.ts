import type { Invoice } from "../../types/invoice.ts";
import type { Quote } from "../../types/quote.ts";
import type { PhaseOneWorkOrder } from "../../types/work-order.ts";
import { OPERATIONAL_THRESHOLDS } from "../config/operational-thresholds.ts";
import { getDisplayInvoiceStatus } from "../invoices/status.ts";
import { isTerminalWorkOrderStatus } from "../work-orders/status.ts";

const activeStatuses = [
  "new",
  "in_review",
  "quote_requested",
  "quote_received",
  "pending_client_approval",
  "approved_to_proceed",
  "dispatched",
  "in_progress",
] as const satisfies readonly PhaseOneWorkOrder["status"][];

export interface WorkOrderOperationalFlags {
  isTerminal: boolean;
  isActive: boolean;
  requiresAttention: boolean;
  isStale: boolean;
  isAwaitingQuote: boolean;
  isAwaitingClientApproval: boolean;
  isReadyToDispatch: boolean;
  isReadyToInvoice: boolean;
  isAwaitingPayment: boolean;
  isReadyToClose: boolean;
}

export interface InvoiceOperationalFlags {
  isOverdue: boolean;
  isActionableByFinance: boolean;
}

export interface QuoteOperationalFlags {
  isCurrent: boolean;
  isBlockingDispatch: boolean;
  needsRevision: boolean;
  isAwaitingReview: boolean;
  isAwaitingClientDecision: boolean;
}

export function getWorkOrderOperationalFlags(
  workOrder: PhaseOneWorkOrder,
  input: {
    currentInvoice?: Invoice | null;
    currentQuote?: Quote | null;
    now?: Date;
  } = {},
): WorkOrderOperationalFlags {
  const isTerminal = isTerminalWorkOrderStatus(workOrder.status);
  const isActive = (activeStatuses as readonly PhaseOneWorkOrder["status"][]).includes(
    workOrder.status,
  );
  const invoiceFlags = input.currentInvoice
    ? getInvoiceOperationalFlags(input.currentInvoice, input.now)
    : null;
  const quoteFlags = input.currentQuote
    ? getQuoteOperationalFlags(workOrder, input.currentQuote)
    : null;

  const isAwaitingQuote =
    workOrder.status === "quote_requested" ||
    (workOrder.requiresQuote && !workOrder.currentQuoteId && !isTerminal);
  const isAwaitingClientApproval =
    workOrder.status === "pending_client_approval" ||
    quoteFlags?.isAwaitingClientDecision === true;
  const isReadyToDispatch =
    workOrder.status === "approved_to_proceed" &&
    (!workOrder.requiresQuote || input.currentQuote?.status === "client_approved");
  const isReadyToInvoice =
    workOrder.status === "completed" && !workOrder.currentInvoiceId;
  const isAwaitingPayment =
    workOrder.status === "invoiced" &&
    (input.currentInvoice?.status === "sent" ||
      input.currentInvoice?.status === "viewed" ||
      input.currentInvoice?.status === "overdue" ||
      invoiceFlags?.isOverdue === true);
  const isReadyToClose =
    workOrder.status === "paid" && input.currentInvoice?.status === "paid";
  const isStale =
    isActive &&
    daysSince(workOrder.updatedAt, input.now ?? new Date()) >=
      OPERATIONAL_THRESHOLDS.staleWorkOrderDays;

  return {
    isTerminal,
    isActive,
    requiresAttention:
      isAwaitingQuote ||
      isAwaitingClientApproval ||
      isReadyToDispatch ||
      isReadyToInvoice ||
      isAwaitingPayment ||
      isReadyToClose ||
      isStale,
    isStale,
    isAwaitingQuote,
    isAwaitingClientApproval,
    isReadyToDispatch,
    isReadyToInvoice,
    isAwaitingPayment,
    isReadyToClose,
  };
}

export function getInvoiceOperationalFlags(
  invoice: Invoice,
  now = new Date(),
): InvoiceOperationalFlags {
  const displayStatus = getDisplayInvoiceStatus(invoice.status, invoice.dueDate, now);

  return {
    isOverdue: displayStatus === "overdue",
    isActionableByFinance:
      invoice.status === "draft" ||
      invoice.status === "sent" ||
      invoice.status === "viewed" ||
      invoice.status === "overdue" ||
      displayStatus === "overdue",
  };
}

export function getQuoteOperationalFlags(
  workOrder: PhaseOneWorkOrder,
  quote: Quote,
): QuoteOperationalFlags {
  const isCurrent = workOrder.currentQuoteId === quote.id;

  return {
    isCurrent,
    isBlockingDispatch:
      workOrder.requiresQuote &&
      isCurrent &&
      quote.status !== "client_approved" &&
      !isTerminalWorkOrderStatus(workOrder.status),
    needsRevision: isCurrent && quote.status === "client_rejected",
    isAwaitingReview:
      isCurrent && (quote.status === "submitted" || quote.status === "under_review"),
    isAwaitingClientDecision: isCurrent && quote.status === "ready_for_client",
  };
}

export function isWorkOrderActive(workOrder: PhaseOneWorkOrder): boolean {
  return getWorkOrderOperationalFlags(workOrder).isActive;
}

function daysSince(value: string | null, now: Date): number {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.floor((now.getTime() - parsed) / 86_400_000);
}
