import { NextRequest } from "next/server";
import {
  getPhaseThreeWorkOrderDetail,
  withPhaseThreeWorkOrderRoute,
} from "@/server/api/work-order-core";
import {
  authorizeWorkOrderEdit,
  authorizeWorkOrderLocationUpdate,
  getWorkOrderApiContext,
  jsonOk,
  parseJsonObject,
  parseUpdateWorkOrderPayload,
  revalidateWorkOrderPaths,
  safeWorkOrderDetail,
  withApiRoute,
} from "@/server/api/work-orders";

interface RouteContext {
  params: Promise<{ workOrderId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  return withPhaseThreeWorkOrderRoute(
    _request,
    "/api/work-orders/[workOrderId]",
    async (context) => {
      const { workOrderId } = await params;
      return getPhaseThreeWorkOrderDetail(context, workOrderId);
    },
  );
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(request, "/api/work-orders/[workOrderId]", async (requestContext) => {
    const { workOrderId } = await params;
    const context = await getWorkOrderApiContext(requestContext);
    const existing = await context.services.workOrders.getById(workOrderId);

    if (!existing.ok) {
      throw existing.error;
    }

    authorizeWorkOrderEdit(context, existing.value);

    const input = parseUpdateWorkOrderPayload(await parseJsonObject(request));
    const nextClientOrganizationId =
      input.clientOrganizationId ?? existing.value.clientOrganizationId;
    const nextLocationId = input.locationId ?? existing.value.locationId;

    if (
      nextClientOrganizationId !== existing.value.clientOrganizationId ||
      nextLocationId !== existing.value.locationId
    ) {
      authorizeWorkOrderLocationUpdate(context, {
        clientOrganizationId: nextClientOrganizationId,
        locationId: nextLocationId,
      });
    }

    const result = await context.services.workOrders.update({
      ...context.audit,
      workOrderId,
      ...input,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateWorkOrderPaths(result.value.id);

    return jsonOk({ workOrder: safeWorkOrderDetail(result.value) });
  });
}
