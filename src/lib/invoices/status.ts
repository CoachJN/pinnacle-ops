import type { InvoiceStatus } from "@/types/invoice";

export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "paid",
  "overdue",
  "void",
] as const satisfies readonly InvoiceStatus[];

export const ACTIVE_INVOICE_STATUSES = [
  "draft",
  "sent",
  "viewed",
  "overdue",
  "paid",
] as const satisfies readonly InvoiceStatus[];

export const TERMINAL_INVOICE_STATUSES = [
  "paid",
  "void",
] as const satisfies readonly InvoiceStatus[];

export const INVOICE_STATUS_LABELS = {
  draft: "Draft",
  issued: "Issued",
  sent: "Sent",
  viewed: "Viewed",
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
} as const satisfies Record<InvoiceStatus, string>;

export const INVOICE_TRANSITIONS = {
  draft: ["sent", "void"],
  issued: ["viewed", "overdue", "paid", "void"],
  sent: ["viewed", "overdue", "paid", "void"],
  viewed: ["overdue", "paid", "void"],
  overdue: ["paid"],
  paid: [],
  void: [],
} as const satisfies Record<InvoiceStatus, readonly InvoiceStatus[]>;

export function getAllowedInvoiceTransitions(
  status: InvoiceStatus,
): readonly InvoiceStatus[] {
  return status === "issued"
    ? INVOICE_TRANSITIONS.issued
    : INVOICE_TRANSITIONS[status as Exclude<InvoiceStatus, "issued">];
}

export function canTransitionInvoiceStatus(
  from: InvoiceStatus,
  to: InvoiceStatus,
): boolean {
  return getAllowedInvoiceTransitions(from).includes(to);
}

export function isTerminalInvoiceStatus(status: InvoiceStatus): boolean {
  return (TERMINAL_INVOICE_STATUSES as readonly InvoiceStatus[]).includes(status);
}

export function isActiveInvoiceStatus(status: InvoiceStatus): boolean {
  return (ACTIVE_INVOICE_STATUSES as readonly InvoiceStatus[]).includes(status);
}

export function getDisplayInvoiceStatus(
  status: InvoiceStatus,
  dueDate: string,
  now = new Date(),
): InvoiceStatus {
  if (status !== "sent" && status !== "viewed") {
    return status;
  }

  const dueAt = Date.parse(dueDate);
  if (!Number.isFinite(dueAt)) {
    return status;
  }

  return dueAt < startOfToday(now).getTime() ? "overdue" : status;
}

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
