import { NextRequest } from "next/server";
import {
  getWorkOrderApiContext,
  parseAssignInternalPayload,
  parseJsonObject,
  revalidateWorkOrderPaths,
  withApiRoute,
} from "@/server/api/work-orders";
import { getRuntimeWorkOrderDetail } from "@/server/api/work-order-runtime";

interface RouteContext {
  params: Promise<{ workOrderId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]/assign-internal",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      const { workOrderId } = await params;
      const payload = parseAssignInternalPayload(await parseJsonObject(request));
      const result = await context.services.workOrders.update({
        ...context.audit,
        workOrderId,
        ...payload,
      });

      if (!result.ok) {
        throw result.error;
      }

      revalidateWorkOrderPaths(workOrderId);
      return getRuntimeWorkOrderDetail(context, workOrderId);
    },
  );
}
