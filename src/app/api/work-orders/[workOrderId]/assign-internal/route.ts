import { NextRequest } from "next/server";
import {
  authorizeWorkOrderEdit,
  getWorkOrderApiContext,
  jsonOk,
  parseAssignInternalPayload,
  parseJsonObject,
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
    "/api/work-orders/[workOrderId]/assign-internal",
    async (requestContext) => {
      const { workOrderId } = await params;
      const context = await getWorkOrderApiContext(requestContext);
      const existing = await context.services.workOrders.getById(workOrderId);

      if (!existing.ok) {
        throw existing.error;
      }

      authorizeWorkOrderEdit(context, existing.value);

      const input = parseAssignInternalPayload(await parseJsonObject(request));
      const result = await context.services.workOrders.assignInternalStaff({
        ...context.audit,
        workOrderId,
        ...input,
      });

      if (!result.ok) {
        throw result.error;
      }

      revalidateWorkOrderPaths(result.value.id);

      return jsonOk({ data: { workOrder: safeWorkOrderDetail(result.value) } });
    },
  );
}
