import type { DashboardQuickAction } from "../permissions/dashboard-permissions.ts";
import { getDashboardConfigForRole } from "../permissions/dashboard-permissions.ts";
import type { Invoice } from "../../types/invoice.ts";
import type { InternalUserRole } from "../../types/permissions.ts";
import { USER_ROLES } from "../../types/permissions.ts";
import type {
  PhaseOneWorkOrder,
  PhaseOneWorkOrderStatus,
} from "../../types/work-order.ts";
import {
  getInvoiceOperationalFlags,
  getWorkOrderOperationalFlags,
} from "../flags/operational-flags.ts";
import { OPERATIONAL_THRESHOLDS } from "../config/operational-thresholds.ts";

export interface DashboardSummary {
  label: string;
  value: number;
  href?: string;
}

export interface DashboardQueue {
  title: string;
  description: string;
  items: PhaseOneWorkOrder[];
  emptyMessage: string;
}

export interface RoleDashboardData {
  eyebrow: string;
  title: string;
  summaries: DashboardSummary[];
  queues: DashboardQueue[];
  quickActions: readonly DashboardQuickAction[];
}

const activeStatuses = [
  "new",
  "in_review",
  "quote_requested",
  "quote_received",
  "pending_client_approval",
  "approved_to_proceed",
  "dispatched",
  "in_progress",
] as const satisfies readonly PhaseOneWorkOrderStatus[];

export function getDashboardDataForRole(
  role: InternalUserRole,
  workOrders: readonly PhaseOneWorkOrder[],
  invoices: readonly Invoice[] = [],
): RoleDashboardData {
  if (role === USER_ROLES.Manager) {
    return getManagerDashboardData(role, workOrders);
  }

  if (role === USER_ROLES.FinanceAdmin) {
    return getFinanceDashboardData(role, workOrders, invoices);
  }

  if (role === USER_ROLES.Owner) {
    return getOwnerDashboardData(role, workOrders, invoices);
  }

  return getCoordinatorDashboardData(role, workOrders);
}

export function getCoordinatorDashboardData(
  role: InternalUserRole,
  workOrders: readonly PhaseOneWorkOrder[],
): RoleDashboardData {
  const config = getDashboardConfigForRole(role);

  return {
    eyebrow: config.eyebrow,
    title: config.title,
    quickActions: config.quickActions,
    summaries: [
      countSummary("New work orders", "new", role, workOrders),
      countSummary("In review", "in_review", role, workOrders),
      countSummary("Quote requested", "quote_requested", role, workOrders),
      countSummary("Quote received", "quote_received", role, workOrders),
      countSummary("Dispatched", "dispatched", role, workOrders),
    ],
    queues: [
      {
        title: "Needs intake attention",
        description: "New and review-stage work that needs coordination.",
        items: byStatuses(workOrders, ["new", "in_review"]).slice(0, 8),
        emptyMessage: "No intake items need attention right now.",
      },
      {
        title: "Quote coordination",
        description: "Requested and received quotes that need coordination follow-up.",
        items: byStatuses(workOrders, ["quote_requested", "quote_received"]).slice(0, 8),
        emptyMessage: "No quote coordination items are queued.",
      },
      {
        title: "Active operational work",
        description: "Dispatched and in-progress records to keep moving.",
        items: byStatuses(workOrders, ["dispatched", "in_progress"]).slice(0, 8),
        emptyMessage: "No dispatched or in-progress records are queued.",
      },
    ],
  };
}

export function getManagerDashboardData(
  role: InternalUserRole,
  workOrders: readonly PhaseOneWorkOrder[],
): RoleDashboardData {
  const config = getDashboardConfigForRole(role);
  const active = byStatuses(workOrders, activeStatuses);
  const staleActive = active.filter((workOrder) =>
    getWorkOrderOperationalFlags(workOrder).isStale,
  );

  return {
    eyebrow: config.eyebrow,
    title: config.title,
    quickActions: config.quickActions,
    summaries: [
      {
        label: "Total active work orders",
        value: active.length,
        href: `/work-orders?role=${role}&view=active`,
      },
      countSummary("In review", "in_review", role, workOrders),
      countSummary("Quote review", "quote_received", role, workOrders),
      countSummary("Pending client approval", "pending_client_approval", role, workOrders),
      {
        label: "Stale active",
        value: staleActive.length,
        href: `/work-orders?role=${role}&view=active`,
      },
    ],
    queues: [
      {
        title: "Quote review queue",
        description: "Submitted contractor quotes needing manager review.",
        items: byStatuses(workOrders, ["quote_received"]).slice(0, 8),
        emptyMessage: "No submitted quotes are waiting for review.",
      },
      {
        title: "Pending client approval",
        description: "Quotes ready for client approval decision recording.",
        items: byStatuses(workOrders, ["pending_client_approval"]).slice(0, 8),
        emptyMessage: "No quotes are pending client approval.",
      },
      {
        title: "Ready to dispatch",
        description: "Approved work that can move into field execution.",
        items: active
          .filter((workOrder) =>
            getWorkOrderOperationalFlags(workOrder).isReadyToDispatch,
          )
          .slice(0, 8),
        emptyMessage: "No approved work orders are waiting for dispatch.",
      },
      {
        title: "Stale active work",
        description: `Active records untouched for ${OPERATIONAL_THRESHOLDS.staleWorkOrderDays} days or more.`,
        items: staleActive.slice(0, 8),
        emptyMessage: "No stale active work is visible right now.",
      },
      {
        title: "Work orders needing review",
        description: "Review-stage, unassigned, or urgent active work.",
        items: recentFirst(
          active.filter(
            (workOrder) =>
              workOrder.status === "in_review" ||
              workOrder.status === "quote_received" ||
              workOrder.status === "pending_client_approval" ||
              !workOrder.assignedManagerName ||
              workOrder.priority === "urgent",
          ),
        ).slice(0, 8),
        emptyMessage: "No review bottlenecks are visible right now.",
      },
      {
        title: "Active work orders",
        description: "Current non-terminal operational work.",
        items: active.slice(0, 8),
        emptyMessage: "No active work orders are queued.",
      },
      {
        title: "Recently updated work orders",
        description: "Latest changes across the operation.",
        items: recentFirst(workOrders).slice(0, 8),
        emptyMessage: "No work order updates are available.",
      },
    ],
  };
}

export function getFinanceDashboardData(
  role: InternalUserRole,
  workOrders: readonly PhaseOneWorkOrder[],
  invoices: readonly Invoice[] = [],
): RoleDashboardData {
  const config = getDashboardConfigForRole(role);
  const readyToInvoice = workOrders.filter(
    (workOrder) => workOrder.status === "completed" && !workOrder.currentInvoiceId,
  );
  const draftInvoices = byCurrentInvoiceStatus(workOrders, invoices, ["draft"]);
  const issuedInvoices = byCurrentInvoiceStatus(workOrders, invoices, ["issued"]);
  const overdueInvoices = byDerivedOverdueInvoice(workOrders, invoices);
  const paidAwaitingClose = byStatuses(workOrders, ["paid"]);

  return {
    eyebrow: config.eyebrow,
    title: config.title,
    quickActions: config.quickActions,
    summaries: [
      {
        label: "Completed awaiting invoice",
        value: readyToInvoice.length,
        href: `/work-orders?role=${role}&view=ready_to_invoice`,
      },
      {
        label: "Draft invoices",
        value: draftInvoices.length,
        href: `/work-orders?role=${role}&view=completed`,
      },
      {
        label: "Issued invoices",
        value: issuedInvoices.length,
        href: `/work-orders?role=${role}&view=invoiced`,
      },
      {
        label: "Overdue invoices",
        value: overdueInvoices.length,
        href: `/work-orders?role=${role}&view=overdue_invoice`,
      },
      {
        label: "Paid awaiting close",
        value: paidAwaitingClose.length,
        href: `/work-orders?role=${role}&view=paid`,
      },
    ],
    queues: [
      {
        title: "Ready to invoice",
        description: "Completed work orders with no active invoice.",
        items: recentFirst(readyToInvoice).slice(0, 8),
        emptyMessage: "No completed work orders are awaiting invoice creation.",
      },
      {
        title: "Invoices to issue",
        description: "Draft invoices that keep work orders in completed state.",
        items: draftInvoices.slice(0, 8),
        emptyMessage: "No draft invoices are waiting to be issued.",
      },
      {
        title: "Overdue invoices",
        description: "Invoiced work orders requiring payment follow-up.",
        items: overdueInvoices.slice(0, 8),
        emptyMessage: "No overdue invoices need attention.",
      },
      {
        title: "Paid work orders ready to close",
        description: "Paid work orders awaiting terminal internal closeout.",
        items: paidAwaitingClose.slice(0, 8),
        emptyMessage: "No paid work orders are awaiting closeout.",
      },
    ],
  };
}

export function getOwnerDashboardData(
  role: InternalUserRole,
  workOrders: readonly PhaseOneWorkOrder[],
  invoices: readonly Invoice[] = [],
): RoleDashboardData {
  const config = getDashboardConfigForRole(role);
  const overdueInvoices = byDerivedOverdueInvoice(workOrders, invoices);
  const paidAwaitingClose = byStatuses(workOrders, ["paid"]);
  const staleActive = byStatuses(workOrders, activeStatuses).filter((workOrder) =>
    getWorkOrderOperationalFlags(workOrder).isStale,
  );

  return {
    eyebrow: config.eyebrow,
    title: config.title,
    quickActions: config.quickActions,
    summaries: [
      {
        label: "Total work orders",
        value: workOrders.length,
        href: `/work-orders?role=${role}`,
      },
      {
        label: "Active work orders",
        value: byStatuses(workOrders, activeStatuses).length,
        href: `/work-orders?role=${role}&view=active`,
      },
      {
        label: "Stale active",
        value: staleActive.length,
        href: `/work-orders?role=${role}&view=active`,
      },
      countSummary("Quote requested", "quote_requested", role, workOrders),
      countSummary("Invoiced", "invoiced", role, workOrders),
      {
        label: "Overdue invoices",
        value: overdueInvoices.length,
        href: `/work-orders?role=${role}&view=overdue_invoice`,
      },
      {
        label: "Paid awaiting close",
        value: paidAwaitingClose.length,
        href: `/work-orders?role=${role}&view=paid`,
      },
    ],
    queues: [
      {
        title: "Quote bottlenecks",
        description: "Quote-related work orders that may block dispatch.",
        items: byStatuses(workOrders, [
          "quote_requested",
          "quote_received",
          "pending_client_approval",
        ]).slice(0, 8),
        emptyMessage: "No quote bottlenecks are visible.",
      },
      {
        title: "Stale active work",
        description: "Active work orders that may need operational follow-up.",
        items: staleActive.slice(0, 8),
        emptyMessage: "No stale active work is visible.",
      },
      {
        title: "Recently updated",
        description: "Latest work order movement.",
        items: recentFirst(workOrders).slice(0, 8),
        emptyMessage: "No recent work order updates are available.",
      },
      {
        title: "Active work orders",
        description: "Open operational workload.",
        items: byStatuses(workOrders, activeStatuses).slice(0, 8),
        emptyMessage: "No active work orders are queued.",
      },
      {
        title: "Completed awaiting close",
        description: "Paid work orders pending terminal closeout.",
        items: paidAwaitingClose.slice(0, 8),
        emptyMessage: "No paid work orders are awaiting close.",
      },
      {
        title: "Finance exceptions",
        description: "Overdue invoices requiring owner visibility.",
        items: overdueInvoices.slice(0, 8),
        emptyMessage: "No overdue invoices are queued.",
      },
    ],
  };
}

function countSummary(
  label: string,
  status: PhaseOneWorkOrderStatus,
  role: InternalUserRole,
  workOrders: readonly PhaseOneWorkOrder[],
): DashboardSummary {
  return {
    label,
    value: workOrders.filter((workOrder) => workOrder.status === status).length,
    href: `/work-orders?role=${role}&status=${status}`,
  };
}

function byStatuses(
  workOrders: readonly PhaseOneWorkOrder[],
  statuses: readonly PhaseOneWorkOrderStatus[],
): PhaseOneWorkOrder[] {
  return recentFirst(
    workOrders.filter((workOrder) => statuses.includes(workOrder.status)),
  );
}

function recentFirst(
  workOrders: readonly PhaseOneWorkOrder[],
): PhaseOneWorkOrder[] {
  return [...workOrders].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
  );
}

function byCurrentInvoiceStatus(
  workOrders: readonly PhaseOneWorkOrder[],
  invoices: readonly Invoice[],
  statuses: readonly Invoice["status"][],
): PhaseOneWorkOrder[] {
  return recentFirst(
    workOrders.filter((workOrder) => {
      const invoice = invoices.find(
        (candidate) => candidate.id === workOrder.currentInvoiceId,
      );

      return invoice ? statuses.includes(invoice.status) : false;
    }),
  );
}

function byDerivedOverdueInvoice(
  workOrders: readonly PhaseOneWorkOrder[],
  invoices: readonly Invoice[],
): PhaseOneWorkOrder[] {
  return recentFirst(
    workOrders.filter((workOrder) => {
      const invoice = invoices.find(
        (candidate) => candidate.id === workOrder.currentInvoiceId,
      );

      return invoice ? getInvoiceOperationalFlags(invoice).isOverdue : false;
    }),
  );
}
