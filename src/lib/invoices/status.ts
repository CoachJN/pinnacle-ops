import type { InvoiceStatus } from "@/types/invoice";

export const INVOICE_STATUSES = [
  "draft",
  "issued",
  "paid",
  "overdue",
  "void",
] as const satisfies readonly InvoiceStatus[];

export const ACTIVE_INVOICE_STATUSES = [
  "draft",
  "issued",
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
  paid: "Paid",
  overdue: "Overdue",
  void: "Void",
} as const satisfies Record<InvoiceStatus, string>;

export const INVOICE_TRANSITIONS = {
  draft: ["issued", "void"],
  issued: ["paid", "overdue", "void"],
  overdue: ["paid", "void"],
  paid: [],
  void: [],
} as const satisfies Record<InvoiceStatus, readonly InvoiceStatus[]>;

export function getAllowedInvoiceTransitions(
  status: InvoiceStatus,
): readonly InvoiceStatus[] {
  return INVOICE_TRANSITIONS[status];
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
  if (status !== "issued") {
    return status;
  }

  const dueAt = Date.parse(dueDate);
  if (!Number.isFinite(dueAt)) {
    return status;
  }

  return dueAt < startOfToday(now).getTime() ? "overdue" : "issued";
}

function startOfToday(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
