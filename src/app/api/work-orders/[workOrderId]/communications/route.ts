import { NextRequest } from "next/server";
import {
  getWorkOrderApiContext,
  parseJsonObject,
  withApiRoute,
} from "@/server/api/work-orders";
import {
  addRuntimeWorkOrderCommunication,
  listRuntimeWorkOrderCommunications,
} from "@/server/api/work-order-runtime";

interface RouteContext {
  params: Promise<{ workOrderId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]/communications",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      const { workOrderId } = await params;
      return listRuntimeWorkOrderCommunications(context, workOrderId);
    },
  );
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]/communications",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      const { workOrderId } = await params;
      return addRuntimeWorkOrderCommunication(
        context,
        workOrderId,
        await parseJsonObject(request),
      );
    },
  );
}
