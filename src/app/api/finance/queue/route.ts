import { NextRequest } from "next/server";
import {
  authorizeFinanceQueueRead,
  createValidationAppError,
  getWorkOrderApiContext,
  jsonError,
  jsonOk,
  parseWorkOrderListLimit,
  safeInvoiceSummary,
  safeWorkOrderSummary,
} from "@/server/api/work-orders";
import type { InvoiceStatus } from "@/types/invoice";

const FINANCE_QUEUE_STATUSES = [
  "draft",
  "issued",
  "overdue",
] as const satisfies readonly InvoiceStatus[];

export async function GET(request: NextRequest) {
  try {
    const context = await getWorkOrderApiContext();
    authorizeFinanceQueueRead(context);

    const limit = parseWorkOrderListLimit(request);
    const statuses = parseFinanceQueueStatuses(request);
    const queue = await context.services.invoices.listFinanceQueue({
      limit,
      statuses,
    });

    if (!queue.ok) {
      throw queue.error;
    }

    const workOrders = await Promise.all(
      queue.value.map((invoice) => context.services.workOrders.getById(invoice.workOrderId)),
    );

    return jsonOk({
      queue: queue.value.map((invoice, index) => {
        const workOrder = workOrders[index];
        return {
          invoice: safeInvoiceSummary(invoice),
          workOrder:
            workOrder.ok ? safeWorkOrderSummary(workOrder.value) : null,
        };
      }),
    });
  } catch (error) {
    return jsonError(error);
  }
}

function parseFinanceQueueStatuses(request: NextRequest): InvoiceStatus[] | undefined {
  const raw = request.nextUrl.searchParams.get("statuses");
  if (!raw) {
    return undefined;
  }

  const statuses = raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (
    statuses.length === 0 ||
    statuses.some(
      (status) =>
        !(FINANCE_QUEUE_STATUSES as readonly string[]).includes(status),
    )
  ) {
    throw createValidationAppError(
      "statuses must be a comma-separated list of draft, issued, or overdue.",
    );
  }

  return statuses as InvoiceStatus[];
}
