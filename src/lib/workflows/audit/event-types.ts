export const TRANSITION_AUDIT_OUTCOMES = {
  Attempted: "ATTEMPTED",
  Rejected: "REJECTED",
  Succeeded: "SUCCEEDED",
  Failed: "FAILED",
} as const;

export type TransitionAuditOutcome =
  (typeof TRANSITION_AUDIT_OUTCOMES)[keyof typeof TRANSITION_AUDIT_OUTCOMES];

export const TRANSITION_EVENT_TYPES = {
  WorkOrderStatusChanged: "WORK_ORDER_STATUS_CHANGED",
  InvoiceStatusChanged: "INVOICE_STATUS_CHANGED",
  QuoteStatusChanged: "QUOTE_STATUS_CHANGED",
} as const;

export type TransitionEventType =
  (typeof TRANSITION_EVENT_TYPES)[keyof typeof TRANSITION_EVENT_TYPES];

