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
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  return withPhaseThreeWorkOrderRoute(
    _request,
    "/api/work-orders/[id]",
    async (context) => {
      const { id } = await params;
      return getPhaseThreeWorkOrderDetail(context, id);
    },
  );
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(request, "/api/work-orders/[id]", async (requestContext) => {
    const { id } = await params;
    const context = await getWorkOrderApiContext(requestContext);
    const existing = await context.services.workOrders.getById(id);

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
      workOrderId: id,
      ...input,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateWorkOrderPaths(result.value.id);

    return jsonOk({ workOrder: safeWorkOrderDetail(result.value) });
  });
}
