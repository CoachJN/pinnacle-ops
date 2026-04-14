import { includesStatus, type LifecycleStatusMetadata } from "./types.ts";

export const INVOICE_STATUS = {
  NotReady: "NOT_READY",
  Ready: "READY",
  Draft: "DRAFT",
  Sent: "SENT",
  Viewed: "VIEWED",
  PartiallyPaid: "PARTIALLY_PAID",
  Paid: "PAID",
  Overdue: "OVERDUE",
  Voided: "VOIDED",
} as const;

export type InvoiceLifecycleStatus =
  (typeof INVOICE_STATUS)[keyof typeof INVOICE_STATUS];

export type InvoiceLifecycleCategory =
  | "preparation"
  | "issued"
  | "payment"
  | "terminal";

export const INVOICE_STATUSES = [
  INVOICE_STATUS.NotReady,
  INVOICE_STATUS.Ready,
  INVOICE_STATUS.Draft,
  INVOICE_STATUS.Sent,
  INVOICE_STATUS.Viewed,
  INVOICE_STATUS.PartiallyPaid,
  INVOICE_STATUS.Paid,
  INVOICE_STATUS.Overdue,
  INVOICE_STATUS.Voided,
] as const satisfies readonly InvoiceLifecycleStatus[];

export const TERMINAL_INVOICE_STATUSES = [
  INVOICE_STATUS.Paid,
  INVOICE_STATUS.Voided,
] as const satisfies readonly InvoiceLifecycleStatus[];

export const NON_TERMINAL_INVOICE_STATUSES = [
  INVOICE_STATUS.NotReady,
  INVOICE_STATUS.Ready,
  INVOICE_STATUS.Draft,
  INVOICE_STATUS.Sent,
  INVOICE_STATUS.Viewed,
  INVOICE_STATUS.PartiallyPaid,
  INVOICE_STATUS.Overdue,
] as const satisfies readonly InvoiceLifecycleStatus[];

export const INVOICE_STATUS_LABELS = {
  [INVOICE_STATUS.NotReady]: "Not Ready",
  [INVOICE_STATUS.Ready]: "Ready",
  [INVOICE_STATUS.Draft]: "Draft",
  [INVOICE_STATUS.Sent]: "Sent",
  [INVOICE_STATUS.Viewed]: "Viewed",
  [INVOICE_STATUS.PartiallyPaid]: "Partially Paid",
  [INVOICE_STATUS.Paid]: "Paid",
  [INVOICE_STATUS.Overdue]: "Overdue",
  [INVOICE_STATUS.Voided]: "Voided",
} as const satisfies Record<InvoiceLifecycleStatus, string>;

export const INVOICE_STATUS_CATEGORIES = {
  [INVOICE_STATUS.NotReady]: "preparation",
  [INVOICE_STATUS.Ready]: "preparation",
  [INVOICE_STATUS.Draft]: "preparation",
  [INVOICE_STATUS.Sent]: "issued",
  [INVOICE_STATUS.Viewed]: "issued",
  [INVOICE_STATUS.PartiallyPaid]: "payment",
  [INVOICE_STATUS.Paid]: "terminal",
  [INVOICE_STATUS.Overdue]: "payment",
  [INVOICE_STATUS.Voided]: "terminal",
} as const satisfies Record<InvoiceLifecycleStatus, InvoiceLifecycleCategory>;

export const INVOICE_STATUS_METADATA = INVOICE_STATUSES.map((status) => ({
  status,
  label: INVOICE_STATUS_LABELS[status],
  category: INVOICE_STATUS_CATEGORIES[status],
  terminal: includesStatus<InvoiceLifecycleStatus>(
    TERMINAL_INVOICE_STATUSES,
    status,
  ),
})) as readonly LifecycleStatusMetadata<
  InvoiceLifecycleStatus,
  InvoiceLifecycleCategory
>[];
