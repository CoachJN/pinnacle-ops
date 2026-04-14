import { NextRequest } from "next/server";
import {
  authorizeWorkOrderCreate,
  getWorkOrderApiContext,
  jsonOk,
  listScopeForActor,
  parseCreateWorkOrderPayload,
  parseJsonObject,
  parseWorkOrderListLimit,
  revalidateWorkOrderPaths,
  safeWorkOrderDetail,
  safeWorkOrderSummary,
  withApiRoute,
} from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/work-orders", async (requestContext) => {
    const context = await getWorkOrderApiContext(requestContext);
    const limit = parseWorkOrderListLimit(request);
    const result = await context.services.workOrders.list(
      listScopeForActor(context.actor, limit),
    );

    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({
      workOrders: result.value.map(safeWorkOrderSummary),
    });
  });
}

export async function POST(request: NextRequest) {
  return withApiRoute(request, "/api/work-orders", async (requestContext) => {
    const context = await getWorkOrderApiContext(requestContext);
    const input = parseCreateWorkOrderPayload(await parseJsonObject(request));

    await authorizeWorkOrderCreate(context, input);

    const result = await context.services.workOrders.create({
      ...context.audit,
      ...input,
      requestedByUserId: input.requestedByUserId ?? context.actor.userId,
    });

    if (!result.ok) {
      throw result.error;
    }

    revalidateWorkOrderPaths(result.value.id);

    return jsonOk({ workOrder: safeWorkOrderDetail(result.value) }, 201);
  });
}
