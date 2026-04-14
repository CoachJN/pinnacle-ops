import { NextRequest } from "next/server";
import {
  authorizeInvoiceEdit,
  authorizeInvoiceRead,
  createNotFoundAppError,
  getWorkOrderApiContext,
  jsonError,
  jsonOk,
  parseJsonObject,
  parseUpdateInvoicePayload,
  revalidateWorkOrderPaths,
  safeInvoiceSummary,
} from "@/server/api/work-orders";

interface RouteContext {
  params: Promise<{ id: string; invoiceId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id, invoiceId } = await params;
    const context = await getWorkOrderApiContext();
    const workOrder = await context.services.workOrders.getById(id);

    if (!workOrder.ok) {
      throw workOrder.error;
    }

    const invoice = await context.services.invoices.getById(invoiceId);
    if (!invoice.ok) {
      throw invoice.error;
    }
    if (invoice.value.workOrderId !== id) {
      throw createNotFoundAppError("Invoice could not be found for this work order.");
    }

    await authorizeInvoiceRead(context, workOrder.value, invoice.value);

    return jsonOk({ invoice: safeInvoiceSummary(invoice.value) });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id, invoiceId } = await params;
    const context = await getWorkOrderApiContext();
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

    await authorizeInvoiceEdit(context, workOrder.value, existing.value);

    const input = parseUpdateInvoicePayload(await parseJsonObject(request));
    const result = await context.services.invoices.updateDraft({
      ...context.audit,
      workOrderId: id,
      invoiceId,
      ...input,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateWorkOrderPaths(id);

    return jsonOk({ invoice: safeInvoiceSummary(result.value) });
  } catch (error) {
    return jsonError(error);
  }
}
