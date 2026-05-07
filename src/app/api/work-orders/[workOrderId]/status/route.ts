import { NextRequest } from "next/server";
import {
  getWorkOrderApiContext,
  parseJsonObject,
  revalidateWorkOrderPaths,
  withApiRoute,
} from "@/server/api/work-orders";
import { getRuntimeWorkOrderDetail } from "@/server/api/work-order-runtime";
import { updateWorkOrderStatusSchema } from "@/modules/work-orders";

interface RouteContext {
  params: Promise<{ workOrderId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]/status",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      const { workOrderId } = await params;
      const payload = updateWorkOrderStatusSchema.parse(await parseJsonObject(request));
      const result = await context.services.workOrders.transition({
        ...context.audit,
        workOrderId,
        toStatus: payload.status,
      });

      if (!result.ok) {
        throw result.error;
      }

      revalidateWorkOrderPaths(workOrderId);
      return getRuntimeWorkOrderDetail(context, workOrderId);
    },
  );
}
