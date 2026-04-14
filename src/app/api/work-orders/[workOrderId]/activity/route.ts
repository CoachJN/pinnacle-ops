import { NextRequest } from "next/server";
import {
  authorizeActivityRead,
  authorizeWorkOrderRead,
  filterVisibleActivityLogsForActor,
  getWorkOrderApiContext,
  jsonOk,
  safeActivityLog,
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
    authorizeActivityRead(context);

    const result = await context.services.activityLogs.listForWorkOrder(workOrderId);
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({
      activity: filterVisibleActivityLogsForActor(
        context.actor,
        result.value,
      ).map(safeActivityLog),
    });
    },
  );
}
