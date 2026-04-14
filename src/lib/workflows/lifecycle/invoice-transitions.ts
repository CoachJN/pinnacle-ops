import { canTransition, includesStatus, type LifecycleTransitionMap } from "./types.ts";
import {
  INVOICE_STATUS,
  NON_TERMINAL_INVOICE_STATUSES,
  TERMINAL_INVOICE_STATUSES,
  type InvoiceLifecycleStatus,
} from "./invoice-status.ts";

function withInvoiceVoiding(
  status: InvoiceLifecycleStatus,
  next: readonly InvoiceLifecycleStatus[],
): readonly InvoiceLifecycleStatus[] {
  if (
    !includesStatus<InvoiceLifecycleStatus>(
      NON_TERMINAL_INVOICE_STATUSES,
      status,
    )
  ) {
    return next;
  }

  return [...next, INVOICE_STATUS.Voided];
}

export const INVOICE_TRANSITION_MAP = {
  [INVOICE_STATUS.NotReady]: withInvoiceVoiding(INVOICE_STATUS.NotReady, [
    INVOICE_STATUS.Ready,
  ]),
  [INVOICE_STATUS.Ready]: withInvoiceVoiding(INVOICE_STATUS.Ready, [
    INVOICE_STATUS.Draft,
  ]),
  [INVOICE_STATUS.Draft]: withInvoiceVoiding(INVOICE_STATUS.Draft, [
    INVOICE_STATUS.Sent,
  ]),
  [INVOICE_STATUS.Sent]: withInvoiceVoiding(INVOICE_STATUS.Sent, [
    INVOICE_STATUS.Viewed,
    INVOICE_STATUS.PartiallyPaid,
    INVOICE_STATUS.Paid,
    INVOICE_STATUS.Overdue,
  ]),
  [INVOICE_STATUS.Viewed]: withInvoiceVoiding(INVOICE_STATUS.Viewed, [
    INVOICE_STATUS.PartiallyPaid,
    INVOICE_STATUS.Paid,
    INVOICE_STATUS.Overdue,
  ]),
  [INVOICE_STATUS.PartiallyPaid]: withInvoiceVoiding(
    INVOICE_STATUS.PartiallyPaid,
    [INVOICE_STATUS.Paid],
  ),
  [INVOICE_STATUS.Paid]: [],
  [INVOICE_STATUS.Overdue]: withInvoiceVoiding(INVOICE_STATUS.Overdue, [
    INVOICE_STATUS.PartiallyPaid,
    INVOICE_STATUS.Paid,
  ]),
  [INVOICE_STATUS.Voided]: [],
} as const satisfies LifecycleTransitionMap<InvoiceLifecycleStatus>;

export function isTerminalInvoiceStatus(status: InvoiceLifecycleStatus): boolean {
  return includesStatus(TERMINAL_INVOICE_STATUSES, status);
}

export function isNonTerminalInvoiceStatus(
  status: InvoiceLifecycleStatus,
): boolean {
  return includesStatus(NON_TERMINAL_INVOICE_STATUSES, status);
}

export function canInvoiceTransition(
  from: InvoiceLifecycleStatus,
  to: InvoiceLifecycleStatus,
): boolean {
  return canTransition(INVOICE_TRANSITION_MAP, from, to);
}
