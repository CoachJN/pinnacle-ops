import { NextRequest } from "next/server";
import {
  authorizeWorkOrderRead,
  getWorkOrderApiContext,
  jsonOk,
  withApiRoute,
} from "@/server/api/work-orders";

interface RouteContext {
  params: Promise<{ workOrderId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    _request,
    "/api/work-orders/[workOrderId]/activity",
    async (requestContext) => {
    const { workOrderId } = await params;
    const context = await getWorkOrderApiContext(requestContext);
    const workOrder = await context.services.workOrders.getById(workOrderId);

    if (!workOrder.ok) {
      throw workOrder.error;
    }

    await authorizeWorkOrderRead(context, workOrder.value);
    const result = await context.services.timeline.listForWorkOrder(
      workOrderId,
      context.actor,
    );
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({
      activity: result.value,
    });
    },
  );
}
