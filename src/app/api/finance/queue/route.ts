import { NextRequest } from "next/server";
import {
  authorizeFinanceQueueRead,
  createValidationAppError,
  getWorkOrderApiContext,
  jsonError,
  jsonOk,
  listScopeForActor,
  parseWorkOrderListLimit,
} from "@/server/api/work-orders";
import {
  buildFinanceQueue,
  filterFinanceQueueItems,
  parseFinanceQueueFilter,
  type FinanceQueueInvoiceRecord,
  type FinanceQueueWorkOrderRecord,
} from "@/modules/finance";
import type { ClientInvoice, WorkOrder } from "@/server/repositories";

export async function GET(request: NextRequest) {
  try {
    const context = await getWorkOrderApiContext();
    authorizeFinanceQueueRead(context);

    const limit = parseWorkOrderListLimit(request);
    const filter = parseFinanceQueueRequestFilter(request);
    const scope = listScopeForActor(context.actor, Math.min(Math.max(limit * 4, 100), 200));
    const [invoiceQueue, workOrders] = await Promise.all([
      context.services.invoices.listFinanceQueue({
        limit: scope.limit,
      }),
      context.services.workOrders.list(scope),
    ]);

    if (!invoiceQueue.ok) {
      throw invoiceQueue.error;
    }
    if (!workOrders.ok) {
      throw workOrders.error;
    }

    const queue = filterFinanceQueueItems(
      buildFinanceQueue({
        workOrders: workOrders.value.map(toFinanceQueueWorkOrderRecord),
        invoices: invoiceQueue.value.map(toFinanceQueueInvoiceRecord),
      }),
      filter,
    ).slice(0, limit);

    return jsonOk({
      queue: queue.map((item) => {
        return {
          id: item.id,
          state: item.state,
          requiresAttention: item.requiresAttention,
          invoice: item.invoice,
          workOrder: item.workOrder,
        };
      }),
      meta: {
        filter,
        total: queue.length,
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

function parseFinanceQueueRequestFilter(request: NextRequest) {
  const view = request.nextUrl.searchParams.get("view");
  const statuses = request.nextUrl.searchParams.get("statuses");

  try {
    if (view) {
      return parseFinanceQueueFilter(view).filter;
    }

    if (!statuses) {
      return "all";
    }

    const normalizedStatuses = statuses
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    if (normalizedStatuses.length !== 1) {
      throw new Error();
    }

    return parseFinanceQueueFilter(mapLegacyStatusFilter(normalizedStatuses[0])).filter;
  } catch {
    throw createValidationAppError(
      "view must be one of all, attention, ready_for_invoicing, draft, sent, overdue, or paid.",
    );
  }
}

function mapLegacyStatusFilter(value: string): string {
  if (value === "viewed") {
    return "sent";
  }

  return value;
}

function toFinanceQueueWorkOrderRecord(
  workOrder: WorkOrder,
): FinanceQueueWorkOrderRecord {
  return {
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
  };
}

function toFinanceQueueInvoiceRecord(
  invoice: ClientInvoice,
): FinanceQueueInvoiceRecord {
  return {
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
  };
}
