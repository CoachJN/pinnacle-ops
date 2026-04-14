import { INVOICE_STATUSES } from "@/lib/invoices/status";
import { QUOTE_STATUSES } from "@/lib/quotes/status";
import { WORK_ORDER_STATUSES } from "@/lib/work-orders/status";
import type { ActivityLogAction } from "@/types/audit";
import type { InvoiceStatus } from "@/types/invoice";
import { USER_ROLES, type UserRole } from "@/types/permissions";
import type { QuoteStatus } from "@/types/quote";
import type { PhaseOneWorkOrderStatus } from "@/types/work-order";

export const ROLE_CODES = USER_ROLES satisfies Record<string, UserRole>;

export { INVOICE_STATUSES, QUOTE_STATUSES, WORK_ORDER_STATUSES };
export type { InvoiceStatus, PhaseOneWorkOrderStatus, QuoteStatus };

export const ASSIGNMENT_TYPES = {
  Primary: "primary",
  Backup: "backup",
  Emergency: "emergency",
  Inspection: "inspection",
} as const;

export type AssignmentType =
  (typeof ASSIGNMENT_TYPES)[keyof typeof ASSIGNMENT_TYPES];

export const ACTIVITY_LOG_ACTION_TYPES = [
  "work_order.created",
  "work_order.updated",
  "work_order.status_changed",
  "work_order.submitted",
  "work_order.assigned",
  "work_order.approved",
  "work_order.scheduled",
  "work_order.completed",
  "work_order.invoiced",
  "work_order.closed",
  "work_order.cancelled",
  "assignment.created",
  "assignment.updated",
  "assignment.status_changed",
  "assignment.accepted",
  "assignment.declined",
  "assignment.completed",
  "assignment.cancelled",
  "contractor_quote.created",
  "contractor_quote.updated",
  "contractor_quote.status_changed",
  "contractor_quote.submitted",
  "contractor_quote.accepted",
  "contractor_quote.rejected",
  "contractor_quote.expired",
  "contractor_quote.cancelled",
  "client_quote.created",
  "client_quote.updated",
  "client_quote.status_changed",
  "client_quote.sent",
  "client_quote.approved",
  "client_quote.rejected",
  "client_quote.expired",
  "client_quote.cancelled",
  "invoice.created",
  "invoice.updated",
  "invoice.status_changed",
  "invoice.issued",
  "invoice.sent",
  "invoice.overdue",
  "invoice.disputed",
  "invoice.resolved",
  "invoice.paid",
  "invoice.voided",
  "invoice.cancelled",
  "client_organization.created",
  "client_organization.updated",
  "client_organization.status_changed",
  "location.created",
  "location.updated",
  "location.status_changed",
  "contractor_organization.created",
  "contractor_organization.updated",
  "contractor_organization.status_changed",
  "user.created",
  "user.updated",
  "user.deactivated",
  "user.reactivated",
  "user.role_changed",
  "role.created",
  "role.updated",
  "comment.created",
  "comment.updated",
  "comment.deleted",
  "attachment.created",
  "attachment.updated",
  "attachment.deleted",
] as const satisfies readonly ActivityLogAction[];
