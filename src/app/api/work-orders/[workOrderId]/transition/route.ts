import { NextRequest } from "next/server";
import {
  authorizeWorkOrderTransition,
  getWorkOrderApiContext,
  jsonOk,
  parseJsonObject,
  parseTransitionPayload,
  revalidateWorkOrderPaths,
  safeWorkOrderDetail,
  withApiRoute,
} from "@/server/api/work-orders";

interface RouteContext {
  params: Promise<{ workOrderId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]/transition",
    async (requestContext) => {
    const { workOrderId } = await params;
    const context = await getWorkOrderApiContext(requestContext);
    const existing = await context.services.workOrders.getById(workOrderId);

    if (!existing.ok) {
      throw existing.error;
    }

    const input = parseTransitionPayload(await parseJsonObject(request));
    authorizeWorkOrderTransition(context, existing.value, input.toStatus);

    const result = await context.services.workOrders.transition({
      ...context.audit,
      workOrderId,
      ...input,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateWorkOrderPaths(result.value.id);

    return jsonOk({ workOrder: safeWorkOrderDetail(result.value) });
    },
  );
}
