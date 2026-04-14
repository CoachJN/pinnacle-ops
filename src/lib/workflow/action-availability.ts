import type { Invoice } from "../../types/invoice.ts";
import type { InternalUserRole } from "../../types/permissions.ts";
import type { Quote } from "../../types/quote.ts";
import type { PhaseOneWorkOrder } from "../../types/work-order.ts";
import {
  canEditWorkOrder,
  canCloseWorkOrder,
  canTransitionWorkOrder,
} from "../permissions/work-order-permissions.ts";
import {
  canCreateQuote,
  canCreateQuoteRevision,
  canEditQuote,
  canRecordClientApproval,
  canRecordClientRejection,
  canRequestQuote,
  canReviewQuote,
  canSendQuoteToClient,
  canSubmitQuote,
} from "../permissions/quote-permissions.ts";
import {
  canClosePaidWorkOrder,
  canCreateInvoice,
  canEditInvoice,
  canIssueInvoice,
  canMarkInvoiceOverdue,
  canMarkInvoicePaid,
  canVoidInvoice,
} from "../permissions/invoice-permissions.ts";

export interface Availability {
  allowed: boolean;
  reason: string | null;
}

export function getWorkOrderActionAvailability(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  input: {
    currentQuote?: Quote | null;
    currentInvoice?: Invoice | null;
  } = {},
) {
  return {
    edit: result(
      canEditWorkOrder(role, workOrder),
      "This work order is read-only for this role or state.",
    ),
    dispatch: result(
      canTransitionWorkOrder(role, workOrder, "dispatched", {
        currentQuoteStatus: input.currentQuote?.status ?? null,
      }),
      workOrder.requiresQuote
        ? "Dispatch is blocked until the current quote is client approved."
        : "This work order cannot be dispatched from its current state.",
    ),
    close: result(
      canCloseWorkOrder(role, workOrder, input.currentInvoice),
      "Closeout requires a paid work order with a paid current invoice.",
    ),
    cancel: result(
      canTransitionWorkOrder(role, workOrder, "cancelled"),
      "This work order cannot be cancelled from its current state.",
    ),
  };
}

export function getQuoteActionAvailability(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  currentQuote: Quote | null,
) {
  return {
    create: result(
      canCreateQuote(role, workOrder),
      "Quote creation is only available while a non-terminal work order is awaiting its first quote.",
    ),
    request: result(
      canRequestQuote(role, workOrder),
      "Quote requests are blocked for terminal records or non-quote states.",
    ),
    edit: result(
      Boolean(currentQuote && canEditQuote(role, workOrder, currentQuote)),
      "Only the current draft quote can be edited.",
    ),
    submit: result(
      Boolean(currentQuote && canSubmitQuote(role, workOrder, currentQuote)),
      "Only the current draft quote can be submitted.",
    ),
    review: result(
      Boolean(currentQuote && canReviewQuote(role, workOrder, currentQuote)),
      "Quote review requires a current submitted or under-review quote.",
    ),
    sendToClient: result(
      Boolean(currentQuote && canSendQuoteToClient(role, workOrder, currentQuote)),
      "Client approval can only be requested after internal review.",
    ),
    approveClientDecision: result(
      Boolean(
        currentQuote && canRecordClientApproval(role, workOrder, currentQuote),
      ),
      "Client approval can only be recorded for the current ready-for-client quote.",
    ),
    rejectClientDecision: result(
      Boolean(
        currentQuote && canRecordClientRejection(role, workOrder, currentQuote),
      ),
      "Client rejection can only be recorded for the current ready-for-client quote.",
    ),
    revise: result(
      Boolean(currentQuote && canCreateQuoteRevision(role, workOrder, currentQuote)),
      "Quote revisions are blocked on terminal work orders and non-current quotes.",
    ),
  };
}

export function getInvoiceActionAvailability(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  currentInvoice: Invoice | null,
) {
  return {
    create: result(
      canCreateInvoice(role, workOrder),
      "Invoice creation requires completed work with no current invoice.",
    ),
    edit: result(
      Boolean(currentInvoice && canEditInvoice(role, workOrder, currentInvoice)),
      "Only the current draft invoice is editable.",
    ),
    issue: result(
      Boolean(currentInvoice && canIssueInvoice(role, workOrder, currentInvoice)),
      "Only the current draft invoice can be issued from completed work.",
    ),
    markPaid: result(
      Boolean(currentInvoice && canMarkInvoicePaid(role, workOrder, currentInvoice)),
      "Payment can only be recorded for the current issued or overdue invoice.",
    ),
    markOverdue: result(
      Boolean(
        currentInvoice && canMarkInvoiceOverdue(role, workOrder, currentInvoice),
      ),
      "Only issued current invoices can be manually marked overdue.",
    ),
    void: result(
      Boolean(currentInvoice && canVoidInvoice(role, workOrder, currentInvoice)),
      "Only the current mutable invoice can be voided.",
    ),
    close: result(
      Boolean(currentInvoice && canClosePaidWorkOrder(role, workOrder, currentInvoice)),
      "Closeout requires the current invoice to be paid.",
    ),
  };
}

function result(allowed: boolean, deniedReason: string): Availability {
  return {
    allowed,
    reason: allowed ? null : deniedReason,
  };
}
