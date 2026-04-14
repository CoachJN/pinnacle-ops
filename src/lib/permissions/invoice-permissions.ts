import type { InternalUserRole } from "../../types/permissions.ts";
import { USER_ROLES } from "../../types/permissions.ts";
import type { Invoice } from "../../types/invoice.ts";
import type { PhaseOneWorkOrder } from "../../types/work-order.ts";
import { canTransitionInvoiceStatus } from "../invoices/status.ts";

function isFinanceController(role: InternalUserRole): boolean {
  return role === USER_ROLES.FinanceAdmin || role === USER_ROLES.Owner;
}

function isInternalInvoiceViewer(role: InternalUserRole): boolean {
  return (
    role === USER_ROLES.Coordinator ||
    role === USER_ROLES.Manager ||
    role === USER_ROLES.FinanceAdmin ||
    role === USER_ROLES.Owner
  );
}

function isCurrentInvoice(
  workOrder: PhaseOneWorkOrder,
  invoice: Invoice,
): boolean {
  return workOrder.currentInvoiceId === invoice.id;
}

function isFinanceMutableWorkOrder(workOrder: PhaseOneWorkOrder): boolean {
  return workOrder.status !== "closed" && workOrder.status !== "cancelled";
}

export function canViewInvoice(
  role: InternalUserRole,
  _workOrder: PhaseOneWorkOrder,
  _invoice?: Invoice | null,
): boolean {
  void _workOrder;
  void _invoice;
  return isInternalInvoiceViewer(role);
}

export function canCreateInvoice(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
): boolean {
  return (
    isFinanceController(role) &&
    workOrder.status === "completed" &&
    !workOrder.currentInvoiceId
  );
}

export function canEditInvoice(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  invoice: Invoice,
): boolean {
  return (
    isFinanceController(role) &&
    isFinanceMutableWorkOrder(workOrder) &&
    isCurrentInvoice(workOrder, invoice) &&
    invoice.status === "draft"
  );
}

export function canIssueInvoice(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  invoice: Invoice,
): boolean {
  return (
    isFinanceController(role) &&
    (workOrder.status === "completed" || workOrder.status === "invoiced") &&
    isCurrentInvoice(workOrder, invoice) &&
    canTransitionInvoiceStatus(invoice.status, "sent")
  );
}

export function canMarkInvoicePaid(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  invoice: Invoice,
): boolean {
  return (
    isFinanceController(role) &&
    workOrder.status === "invoiced" &&
    isCurrentInvoice(workOrder, invoice) &&
    canTransitionInvoiceStatus(invoice.status, "paid")
  );
}

export function canMarkInvoiceOverdue(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  invoice: Invoice,
): boolean {
  return (
    isFinanceController(role) &&
    workOrder.status === "invoiced" &&
    isCurrentInvoice(workOrder, invoice) &&
    canTransitionInvoiceStatus(invoice.status, "overdue")
  );
}

export function canVoidInvoice(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  invoice: Invoice,
): boolean {
  return (
    isFinanceController(role) &&
    isFinanceMutableWorkOrder(workOrder) &&
    isCurrentInvoice(workOrder, invoice) &&
    canTransitionInvoiceStatus(invoice.status, "void")
  );
}

export function canTransitionWorkOrderToInvoiced(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  invoice?: Invoice | null,
): boolean {
  return (
    isFinanceController(role) &&
    workOrder.status === "completed" &&
    invoice?.status === "sent" &&
    workOrder.currentInvoiceId === invoice.id
  );
}

export function canTransitionWorkOrderToPaid(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  invoice?: Invoice | null,
): boolean {
  return (
    isFinanceController(role) &&
    workOrder.status === "invoiced" &&
    invoice?.status === "paid" &&
    workOrder.currentInvoiceId === invoice.id
  );
}

export function canClosePaidWorkOrder(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  invoice?: Invoice | null,
): boolean {
  return (
    isFinanceController(role) &&
    workOrder.status === "paid" &&
    invoice?.status === "paid" &&
    workOrder.currentInvoiceId === invoice.id
  );
}
