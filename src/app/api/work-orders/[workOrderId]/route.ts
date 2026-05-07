import { NextRequest } from "next/server";
import {
  getWorkOrderApiContext,
  parseJsonObject,
  parseUpdateWorkOrderPayload,
  revalidateWorkOrderPaths,
  withApiRoute,
} from "@/server/api/work-orders";
import { getRuntimeWorkOrderDetail } from "@/server/api/work-order-runtime";

interface RouteContext {
  params: Promise<{ workOrderId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    _request,
    "/api/work-orders/[workOrderId]",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      const { workOrderId } = await params;
      return getRuntimeWorkOrderDetail(context, workOrderId);
    },
  );
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      const { workOrderId } = await params;
      const payload = parseUpdateWorkOrderPayload(await parseJsonObject(request));
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
