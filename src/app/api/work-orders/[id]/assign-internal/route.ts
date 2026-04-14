import { NextRequest } from "next/server";
import {
  authorizeWorkOrderEdit,
  getWorkOrderApiContext,
  jsonError,
  jsonOk,
  parseAssignInternalPayload,
  parseJsonObject,
  revalidateWorkOrderPaths,
  safeWorkOrderDetail,
} from "@/server/api/work-orders";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const context = await getWorkOrderApiContext();
    const existing = await context.services.workOrders.getById(id);

    if (!existing.ok) {
      throw existing.error;
    }

    authorizeWorkOrderEdit(context, existing.value);

    const input = parseAssignInternalPayload(await parseJsonObject(request));
    const result = await context.services.workOrders.assignInternalStaff({
      ...context.audit,
      workOrderId: id,
      ...input,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateWorkOrderPaths(result.value.id);

    return jsonOk({ workOrder: safeWorkOrderDetail(result.value) });
  } catch (error) {
    return jsonError(error);
  }
}
