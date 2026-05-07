import { NextRequest } from "next/server";
import {
  getWorkOrderApiContext,
  parseCreateWorkOrderPayload,
  parseJsonObject,
  withApiRoute,
} from "@/server/api/work-orders";
import {
  createRuntimeWorkOrder,
  listRuntimeWorkOrders,
} from "@/server/api/work-order-runtime";

export async function GET(request: NextRequest) {
  return withApiRoute(
    request,
    "/api/work-orders",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      return listRuntimeWorkOrders(context, request);
    },
  );
}

export async function POST(request: NextRequest) {
  return withApiRoute(
    request,
    "/api/work-orders",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      const payload = parseCreateWorkOrderPayload(await parseJsonObject(request));
      return createRuntimeWorkOrder(context, payload);
    },
  );
}
