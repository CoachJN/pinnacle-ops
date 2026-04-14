import { NextRequest } from "next/server";
import {
  authorizeInvoiceCreate,
  authorizeInvoiceRead,
  getWorkOrderApiContext,
  jsonOk,
  parseCreateInvoicePayload,
  parseJsonObject,
  revalidateWorkOrderPaths,
  safeInvoiceSummary,
  withApiRoute,
} from "@/server/api/work-orders";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    _request,
    "/api/work-orders/[id]/invoices",
    async (requestContext) => {
    const { id } = await params;
    const context = await getWorkOrderApiContext(requestContext);
    const workOrder = await context.services.workOrders.getById(id);

    if (!workOrder.ok) {
      throw workOrder.error;
    }

    const invoices = await context.services.invoices.listByWorkOrderId(id);
    if (!invoices.ok) {
      throw invoices.error;
    }

    await Promise.all(
      invoices.value.map((invoice) =>
        authorizeInvoiceRead(context, workOrder.value, invoice),
      ),
    );

    return jsonOk({
      invoices: invoices.value.map(safeInvoiceSummary),
    });
    },
  );
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[id]/invoices",
    async (requestContext) => {
    const { id } = await params;
    const context = await getWorkOrderApiContext(requestContext);
    const workOrder = await context.services.workOrders.getById(id);

    if (!workOrder.ok) {
      throw workOrder.error;
    }

    await authorizeInvoiceCreate(context, workOrder.value);

    const input = parseCreateInvoicePayload(await parseJsonObject(request));
    const result = await context.services.invoices.create({
      ...context.audit,
      workOrderId: id,
      ...input,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateWorkOrderPaths(id);

    return jsonOk({ invoice: safeInvoiceSummary(result.value) }, 201);
    },
  );
}
