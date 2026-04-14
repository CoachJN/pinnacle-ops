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
  params: Promise<{ workOrderId: string; invoiceId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]/invoices/[invoiceId]/transition",
    async (requestContext) => {
    const { workOrderId, invoiceId } = await params;
    const context = await getWorkOrderApiContext(requestContext);
    const workOrder = await context.services.workOrders.getById(workOrderId);

    if (!workOrder.ok) {
      throw workOrder.error;
    }

    const existing = await context.services.invoices.getById(invoiceId);
    if (!existing.ok) {
      throw existing.error;
    }
    if (existing.value.workOrderId !== workOrderId) {
      throw createNotFoundAppError("Invoice could not be found for this work order.");
    }

    const input = parseInvoiceTransitionPayload(await parseJsonObject(request));
    await authorizeInvoiceTransition(
      context,
      workOrder.value,
      existing.value,
      input.toStatus,
    );

    const result =
      input.toStatus === "sent"
        ? await context.services.invoices.sendInvoice({
            ...context.audit,
            workOrderId,
            invoiceId,
            issuedDate: input.issuedDate ?? undefined,
            sentAt: input.sentAt ?? undefined,
          })
        : input.toStatus === "viewed"
          ? await context.services.invoices.markInvoiceViewed({
              ...context.audit,
              workOrderId,
              invoiceId,
              viewedAt: input.viewedAt ?? undefined,
            })
          : input.toStatus === "paid"
            ? await context.services.invoices.markInvoicePaid({
                ...context.audit,
                workOrderId,
                invoiceId,
                paidAt: input.paidAt ?? undefined,
                paymentReference: input.paymentReference ?? undefined,
              })
            : input.toStatus === "overdue"
              ? await context.services.invoices.markInvoiceOverdue({
                  ...context.audit,
                  workOrderId,
                  invoiceId,
                })
              : input.toStatus === "void"
                ? await context.services.invoices.voidInvoice({
                    ...context.audit,
                    workOrderId,
                    invoiceId,
                    voidedAt: input.voidedAt ?? undefined,
                  })
                : await context.services.invoices.transition({
                    ...context.audit,
                    workOrderId,
                    invoiceId,
                    toStatus: input.toStatus,
                    paymentReference: input.paymentReference ?? undefined,
                    issuedDate: input.issuedDate ?? undefined,
                    sentAt: input.sentAt ?? undefined,
                    viewedAt: input.viewedAt ?? undefined,
                    paidAt: input.paidAt ?? undefined,
                    voidedAt: input.voidedAt ?? undefined,
                  });

    if (!result.ok) {
      throw result.error;
    }

    const refreshedWorkOrder = await context.services.workOrders.getById(workOrderId);
    if (!refreshedWorkOrder.ok) {
      throw refreshedWorkOrder.error;
    }

    revalidateWorkOrderPaths(workOrderId);

    return jsonOk({
      invoice: safeInvoiceSummary(result.value),
      workOrder: safeWorkOrderDetail(refreshedWorkOrder.value),
    });
    },
  );
}
