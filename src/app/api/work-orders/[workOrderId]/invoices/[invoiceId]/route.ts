import { NextRequest } from "next/server";
import {
  authorizeInvoiceEdit,
  authorizeInvoiceRead,
  createNotFoundAppError,
  getWorkOrderApiContext,
  jsonOk,
  parseJsonObject,
  parseUpdateInvoicePayload,
  revalidateWorkOrderPaths,
  safeInvoiceSummary,
  withApiRoute,
} from "@/server/api/work-orders";

interface RouteContext {
  params: Promise<{ workOrderId: string; invoiceId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    _request,
    "/api/work-orders/[workOrderId]/invoices/[invoiceId]",
    async (requestContext) => {
      const { workOrderId, invoiceId } = await params;
      const context = await getWorkOrderApiContext(requestContext);
      const workOrder = await context.services.workOrders.getById(workOrderId);

      if (!workOrder.ok) {
        throw workOrder.error;
      }

      const invoice = await context.services.invoices.getById(invoiceId);
      if (!invoice.ok) {
        throw invoice.error;
      }
      if (invoice.value.workOrderId !== workOrderId) {
        throw createNotFoundAppError("Invoice could not be found for this work order.");
      }

      await authorizeInvoiceRead(context, workOrder.value, invoice.value);

      return jsonOk({ invoice: safeInvoiceSummary(invoice.value) });
    },
  );
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]/invoices/[invoiceId]",
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

      await authorizeInvoiceEdit(context, workOrder.value, existing.value);

      const input = parseUpdateInvoicePayload(await parseJsonObject(request));
      const result = await context.services.invoices.updateDraft({
        ...context.audit,
        workOrderId,
        invoiceId,
        ...input,
      });

      if (!result.ok) {
        throw result.error;
      }

      revalidateWorkOrderPaths(workOrderId);

      return jsonOk({ invoice: safeInvoiceSummary(result.value) });
    },
  );
}
