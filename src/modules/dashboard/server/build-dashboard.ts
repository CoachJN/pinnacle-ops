import "server-only";

import { APP_PATHS } from "../../../lib/utils/constants.ts";
import { buildFinanceQueue, type FinanceQueueItem } from "../../finance/index.ts";
import type { OperationalAlertItem } from "../../notifications/index.ts";
import {
  buildDashboardSummaryCards,
  type DashboardAtRiskItem,
  type DashboardFinanceAttentionItem,
  type DashboardSummaryCounts,
  type DashboardWorkQueueItem,
  type InternalDashboardData,
} from "../domain/index.ts";
import type { DashboardQueueSection } from "../domain/types.ts";
import { getDashboardVisibilityForRole } from "./role-visibility.ts";
import type {
  Assignment,
  ClientInvoice as Invoice,
  WorkOrder,
} from "../../../server/repositories/index.ts";
import type { InternalUserRole } from "../../../types/permissions.ts";
import type { AssignmentStatus, WorkOrderStatus } from "../../../types/work-order.ts";

const TERMINAL_WORK_ORDER_STATUSES = new Set<WorkOrderStatus>([
  "closed",
  "cancelled",
] as const);

const DISPATCH_ACTIVE_STATUSES = new Set<AssignmentStatus>([
  "assigned",
  "accepted",
] as const);

export interface BuildInternalDashboardParams {
  context: DashboardContext;
  limit?: number;
  now?: string;
}

export interface BuildDashboardDataInput {
  role: InternalUserRole;
  alerts: readonly OperationalAlertItem[];
  workOrders: readonly WorkOrder[];
  activeAssignmentsByWorkOrderId: ReadonlyMap<string, Assignment | null>;
  financeQueueItems?: readonly FinanceQueueItem[];
  now?: string;
}

export interface DashboardContext {
  actor: {
    actorType: "internal";
    role: InternalUserRole;
    userId: string;
    scope: {
      organizationId: string;
    };
  };
  services: {
    workOrders: {
      list(input: {
        scope: "organization";
        organizationId: string;
        limit: number;
      }): Promise<{ ok: true; value: WorkOrder[] } | { ok: false; error: Error }>;
    };
    notifications: {
      listAlertsForUser(input: {
        recipientUserId: string;
        limit: number;
        now?: string;
      }): Promise<
        | { ok: true; value: readonly OperationalAlertItem[] }
        | { ok: false; error: Error }
      >;
    };
    invoices: {
      listFinanceQueue(input: {
        limit: number;
      }): Promise<
        | { ok: true; value: InvoiceListItem[] }
        | { ok: false; error: Error }
      >;
    };
  };
  repositories: {
    assignments: {
      getActiveByWorkOrderId(workOrderId: string): Promise<Assignment | null>;
    };
  };
}

type InvoiceListItem = Pick<
  Invoice,
  | "id"
  | "workOrderId"
  | "invoiceNumber"
  | "status"
  | "dueDate"
  | "totalAmount"
  | "currency"
  | "sentAt"
  | "viewedAt"
  | "paidAt"
  | "updatedAt"
>;

export async function buildInternalDashboard(
  input: BuildInternalDashboardParams,
): Promise<InternalDashboardData> {
  if (input.context.actor.actorType !== "internal") {
    throw new Error("Internal dashboard shaping requires an internal actor.");
  }

  const role = input.context.actor.role;
  const visibility = getDashboardVisibilityForRole(role);
  const scope = {
    scope: "organization" as const,
    organizationId: input.context.actor.scope.organizationId,
    limit: input.limit ?? 200,
  };
  const [workOrdersResult, alertsResult] = await Promise.all([
    input.context.services.workOrders.list(scope),
    input.context.services.notifications.listAlertsForUser({
      recipientUserId: input.context.actor.userId,
      limit: 8,
      now: input.now,
    }),
  ]);

  if (!workOrdersResult.ok) {
    throw workOrdersResult.error;
  }
  if (!alertsResult.ok) {
    throw alertsResult.error;
  }

  const activeAssignmentsByWorkOrderId = await loadActiveAssignmentsByWorkOrderId({
    context: input.context,
    workOrders: workOrdersResult.value,
  });

  let financeQueueItems: FinanceQueueItem[] = [];
  if (visibility.showFinanceAttention) {
    const financeQueueResult = await input.context.services.invoices.listFinanceQueue({
      limit: scope.limit,
    });
    if (!financeQueueResult.ok) {
      throw financeQueueResult.error;
    }

    financeQueueItems = buildFinanceQueue({
      workOrders: workOrdersResult.value.map((workOrder) => ({
        id: workOrder.id,
        workOrderNumber: workOrder.workOrderNumber,
        title: workOrder.title,
        lifecycleStatus: workOrder.lifecycleStatus,
        priority: workOrder.priority,
        clientOrganizationId: workOrder.clientOrganizationId,
        locationId: workOrder.locationId,
        currentInvoiceId: workOrder.currentInvoiceId,
        clientSnapshot: workOrder.clientSnapshot,
        locationSnapshot: workOrder.locationSnapshot,
        completedAt: workOrder.completedAt ?? workOrder.workCompletedAt ?? null,
        updatedAt: workOrder.updatedAt,
      })),
      invoices: financeQueueResult.value.map((invoice) => ({
        id: invoice.id,
        workOrderId: invoice.workOrderId,
        invoiceNumber: invoice.invoiceNumber,
        status: invoice.status,
        dueDate: invoice.dueDate,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
        sentAt: invoice.sentAt,
        viewedAt: invoice.viewedAt,
        paidAt: invoice.paidAt,
        updatedAt: invoice.updatedAt,
      })),
      now: input.now,
    });
  }

  return buildDashboardData({
    role,
    alerts: alertsResult.value,
    workOrders: workOrdersResult.value,
    activeAssignmentsByWorkOrderId,
    financeQueueItems,
    now: input.now,
  });
}

export function buildDashboardData(
  input: BuildDashboardDataInput,
): InternalDashboardData {
  const generatedAt = input.now ?? new Date().toISOString();
  const visibility = getDashboardVisibilityForRole(input.role);
  const financeQueueItems = input.financeQueueItems ?? [];

  const awaitingAssignment = input.workOrders.filter((workOrder) => {
    if (workOrder.lifecycleStatus !== "client_approved") {
      return false;
    }

    return input.activeAssignmentsByWorkOrderId.get(workOrder.id) == null;
  });

  const awaitingContractorResponse = input.workOrders.filter((workOrder) => {
    const assignment = input.activeAssignmentsByWorkOrderId.get(workOrder.id);
    return assignment?.status === "assigned";
  });

  const quoteReview = input.workOrders.filter(
    (workOrder) => workOrder.lifecycleStatus === "contractor_quote_received",
  );
  const clientAction = input.workOrders.filter(
    (workOrder) => workOrder.lifecycleStatus === "client_approval_requested",
  );

  const summaryCounts: DashboardSummaryCounts = {
    openWorkOrders: input.workOrders.filter(
      (workOrder) => !TERMINAL_WORK_ORDER_STATUSES.has(workOrder.lifecycleStatus),
    ).length,
    awaitingAssignment: awaitingAssignment.length,
    awaitingContractorResponse: awaitingContractorResponse.length,
    awaitingQuoteReview: quoteReview.length,
    awaitingClientAction: clientAction.length,
    readyForInvoicing: financeQueueItems.filter(
      (item) => item.state === "ready_for_invoicing",
    ).length,
    overdueInvoices: financeQueueItems.filter(
      (item) => item.state === "overdue",
    ).length,
    activeAlerts: input.alerts.length,
  };

  const dispatchAttention = buildDispatchAttentionSection({
    workOrders: input.workOrders,
    activeAssignmentsByWorkOrderId: input.activeAssignmentsByWorkOrderId,
  });
  const quoteBottlenecks = buildQuoteBottlenecksSection(input.workOrders);
  const financeAttention = buildFinanceAttentionSection(financeQueueItems);
  const atRiskItems = buildAtRiskItemsSection({
    workOrders: input.workOrders,
    financeQueueItems,
    alerts: input.alerts,
    activeAssignmentsByWorkOrderId: input.activeAssignmentsByWorkOrderId,
    now: generatedAt,
  });

  return {
    generatedAt,
    role: input.role,
    summaryCounts,
    summaryCards: buildDashboardSummaryCards({
      counts: summaryCounts,
      order: visibility.summaryCardOrder,
    }),
    queueSections: {
      dispatchAttention,
      quoteBottlenecks,
      financeAttention,
      atRiskItems,
    },
    alerts: input.alerts,
    visibility,
  };
}

async function loadActiveAssignmentsByWorkOrderId(input: {
  context: DashboardContext;
  workOrders: readonly WorkOrder[];
}): Promise<Map<string, Assignment | null>> {
  const relevantWorkOrders = input.workOrders.filter((workOrder) => {
    return (
      workOrder.lifecycleStatus === "client_approved" ||
      workOrder.lifecycleStatus === "assigned" ||
      workOrder.lifecycleStatus === "awaiting_contractor_response" ||
      workOrder.lifecycleStatus === "in_progress"
    );
  });

  const assignmentPairs = await Promise.all(
    relevantWorkOrders.map(async (workOrder) => [
      workOrder.id,
      await input.context.repositories.assignments.getActiveByWorkOrderId(
        workOrder.id,
      ),
    ] as const),
  );

  return new Map(assignmentPairs);
}

function buildDispatchAttentionSection(input: {
  workOrders: readonly WorkOrder[];
  activeAssignmentsByWorkOrderId: ReadonlyMap<string, Assignment | null>;
}): DashboardQueueSection<DashboardWorkQueueItem> {
  const items = input.workOrders.flatMap((workOrder) => {
    const assignment = input.activeAssignmentsByWorkOrderId.get(workOrder.id) ?? null;

    if (workOrder.lifecycleStatus === "client_approved" && !assignment) {
      return [toWorkQueueItem(workOrder, {
        reason: "Client approved the work and it is ready for contractor assignment.",
        assignmentStatus: null,
      })];
    }

    if (assignment?.status === "assigned") {
      return [toWorkQueueItem(workOrder, {
        reason: "Contractor assignment is waiting for acceptance or decline.",
        assignmentStatus: assignment.status,
      })];
    }

    if (
      assignment?.status === "accepted" &&
      workOrder.lifecycleStatus !== "in_progress" &&
      workOrder.lifecycleStatus !== "work_completed"
    ) {
      return [toWorkQueueItem(workOrder, {
        reason: "Contractor accepted the work; move it into active execution.",
        assignmentStatus: assignment.status,
      })];
    }

    return [];
  });

  return {
    title: "Dispatch attention",
    description: "Work that is ready to assign, waiting on contractor confirmation, or needs the next dispatch step.",
    emptyMessage: "No dispatch items need immediate attention.",
    items: sortWorkQueueItems(items).slice(0, 8),
  };
}

function buildQuoteBottlenecksSection(
  workOrders: readonly WorkOrder[],
): DashboardQueueSection<DashboardWorkQueueItem> {
  const items = workOrders.flatMap((workOrder) => {
    if (workOrder.lifecycleStatus === "quote_required") {
      return [toWorkQueueItem(workOrder, {
        reason: "Waiting on a contractor quote submission.",
        assignmentStatus: null,
      })];
    }

    if (workOrder.lifecycleStatus === "contractor_quote_received") {
      return [toWorkQueueItem(workOrder, {
        reason: "Submitted contractor quote needs internal review.",
        assignmentStatus: null,
      })];
    }

    if (workOrder.lifecycleStatus === "client_approval_requested") {
      return [toWorkQueueItem(workOrder, {
        reason: "Client approval is still outstanding.",
        assignmentStatus: null,
      })];
    }

    return [];
  });

  return {
    title: "Quote bottlenecks",
    description: "Quote and approval work that is blocking dispatch or client progress.",
    emptyMessage: "No quote bottlenecks are visible right now.",
    items: sortWorkQueueItems(items).slice(0, 8),
  };
}

function buildFinanceAttentionSection(
  financeQueueItems: readonly FinanceQueueItem[],
): DashboardQueueSection<DashboardFinanceAttentionItem> {
  const items = financeQueueItems
    .filter((item) => item.requiresAttention)
    .map((item) => ({
      id: item.id,
      href: item.invoice
        ? `/dashboard/work-orders/${item.workOrder.id}/invoice/${item.invoice.id}`
        : `/dashboard/work-orders/${item.workOrder.id}`,
      state: item.state,
      requiresAttention: item.requiresAttention,
      workOrderId: item.workOrder.id,
      workOrderNumber: item.workOrder.workOrderNumber,
      title: item.workOrder.title,
      clientName: item.workOrder.clientSnapshot?.name ?? "Unknown client",
      locationName: item.workOrder.locationSnapshot?.name ?? "Unknown location",
      invoiceId: item.invoice?.id ?? null,
      invoiceNumber: item.invoice?.invoiceNumber ?? null,
      invoiceStatus: item.invoice?.status ?? null,
      dueDate: item.invoice?.dueDate ?? null,
      totalAmount: item.invoice?.totalAmount ?? null,
      currency: item.invoice?.currency ?? null,
    }))
    .slice(0, 8);

  return {
    title: "Finance attention",
    description: "Ready-to-bill work and overdue receivables that need finance follow-up.",
    emptyMessage: "No finance items are waiting for attention.",
    items,
  };
}

function buildAtRiskItemsSection(input: {
  workOrders: readonly WorkOrder[];
  financeQueueItems: readonly FinanceQueueItem[];
  alerts: readonly OperationalAlertItem[];
  activeAssignmentsByWorkOrderId: ReadonlyMap<string, Assignment | null>;
  now: string;
}): DashboardQueueSection<DashboardAtRiskItem> {
  const items: DashboardAtRiskItem[] = [];

  for (const workOrder of input.workOrders) {
    const ageDays = ageInDays(workOrder.updatedAt, input.now);
    if (ageDays >= 3 && !TERMINAL_WORK_ORDER_STATUSES.has(workOrder.lifecycleStatus)) {
      const assignment = input.activeAssignmentsByWorkOrderId.get(workOrder.id);
      items.push({
        id: `risk-work-order-${workOrder.id}`,
        kind: "work_order",
        title: `${workOrder.workOrderNumber} needs follow-up`,
        description:
          assignment?.status === "assigned"
            ? "Contractor response is still pending and the work order has gone stale."
            : `Work order has been idle for ${ageDays} days in ${formatLifecycleStatusLabel(workOrder.lifecycleStatus)}.`,
        href: `${APP_PATHS.workOrders}/${workOrder.id}`,
        severity: ageDays >= 7 ? "risk" : "attention",
        updatedAt: workOrder.updatedAt,
      });
    }
  }

  for (const item of input.financeQueueItems) {
    if (item.state !== "overdue") {
      continue;
    }

    items.push({
      id: `risk-invoice-${item.workOrder.id}`,
      kind: "invoice",
      title: `${item.workOrder.workOrderNumber} has an overdue invoice`,
      description: item.invoice
        ? `${item.invoice.invoiceNumber} is overdue and needs collections follow-up.`
        : "Invoice follow-up is overdue.",
      href: item.invoice
        ? `/dashboard/work-orders/${item.workOrder.id}/invoice/${item.invoice.id}`
        : `${APP_PATHS.workOrders}/${item.workOrder.id}`,
      severity: "risk",
      updatedAt: item.invoice?.updatedAt ?? item.workOrder.updatedAt,
    });
  }

  for (const alert of input.alerts) {
    if (alert.state === "active") {
      continue;
    }

    items.push({
      id: `risk-alert-${alert.id}`,
      kind: "alert",
      title: alert.title,
      description: alert.message,
      href: alert.targetPath,
      severity: alert.state === "at_risk" ? "attention" : "risk",
      updatedAt: alert.createdAt,
    });
  }

  return {
    title: "At risk and overdue",
    description: "Stalled work, overdue invoices, and alert-driven follow-up risks.",
    emptyMessage: "No at-risk operational items are visible right now.",
    items: items
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, 8),
  };
}

function toWorkQueueItem(
  workOrder: WorkOrder,
  input: {
    reason: string;
    assignmentStatus: AssignmentStatus | null;
  },
): DashboardWorkQueueItem {
  return {
    id: `dashboard-work-order-${workOrder.id}-${input.assignmentStatus ?? workOrder.lifecycleStatus}`,
    workOrderId: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    title: workOrder.title,
    lifecycleStatus: workOrder.lifecycleStatus,
    priority: workOrder.priority,
    clientName: workOrder.clientSnapshot.name,
    locationName: workOrder.locationSnapshot.name,
    updatedAt: workOrder.updatedAt,
    href: `${APP_PATHS.workOrders}/${workOrder.id}`,
    reason: input.reason,
    assignmentStatus: input.assignmentStatus,
  };
}

function sortWorkQueueItems(
  items: readonly DashboardWorkQueueItem[],
): DashboardWorkQueueItem[] {
  return [...items].sort((left, right) => {
    const priorityDelta = comparePriority(left.priority, right.priority);
    if (priorityDelta !== 0) {
      return priorityDelta;
    }

    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt);
  });
}

function comparePriority(left: string, right: string): number {
  return priorityScore(right) - priorityScore(left);
}

function formatLifecycleStatusLabel(
  lifecycleStatus: WorkOrderStatus | null | undefined,
): string {
  if (typeof lifecycleStatus !== "string" || lifecycleStatus.length === 0) {
    return "an unknown status";
  }

  return lifecycleStatus.replaceAll("_", " ");
}

function priorityScore(priority: string): number {
  switch (priority) {
    case "urgent":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function ageInDays(value: string, now: string): number {
  const timestamp = Date.parse(value);
  const reference = Date.parse(now);
  if (!Number.isFinite(timestamp)) {
    return 0;
  }
  if (!Number.isFinite(reference)) {
    return 0;
  }

  return Math.floor((reference - timestamp) / 86_400_000);
}
