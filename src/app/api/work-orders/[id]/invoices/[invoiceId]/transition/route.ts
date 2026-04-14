import { NextRequest } from "next/server";
import {
  authorizeInvoiceTransition,
  createNotFoundAppError,
  getWorkOrderApiContext,
  jsonOk,
  parseInvoiceTransitionPayload,
  parseJsonObject,
  revalidateWorkOrderPaths,
  safeInvoiceSummary,
  safeWorkOrderDetail,
  withApiRoute,
} from "@/server/api/work-orders";

interface RouteContext {
  params: Promise<{ id: string; invoiceId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[id]/invoices/[invoiceId]/transition",
    async (requestContext) => {
    const { id, invoiceId } = await params;
    const context = await getWorkOrderApiContext(requestContext);
    const workOrder = await context.services.workOrders.getById(id);

    if (!workOrder.ok) {
      throw workOrder.error;
    }

    const existing = await context.services.invoices.getById(invoiceId);
    if (!existing.ok) {
      throw existing.error;
    }
    if (existing.value.workOrderId !== id) {
      throw createNotFoundAppError("Invoice could not be found for this work order.");
    }

    const input = parseInvoiceTransitionPayload(await parseJsonObject(request));
    await authorizeInvoiceTransition(
      context,
      workOrder.value,
      existing.value,
      input.toStatus,
    );

    const result = await context.services.invoices.transition({
      ...context.audit,
      workOrderId: id,
      invoiceId,
      ...input,
    });

    if (!result.ok) {
      throw result.error;
    }

    const refreshedWorkOrder = await context.services.workOrders.getById(id);
    if (!refreshedWorkOrder.ok) {
      throw refreshedWorkOrder.error;
    }

    revalidateWorkOrderPaths(id);

    return jsonOk({
      invoice: safeInvoiceSummary(result.value),
      workOrder: safeWorkOrderDetail(refreshedWorkOrder.value),
    });
    },
  );
}
