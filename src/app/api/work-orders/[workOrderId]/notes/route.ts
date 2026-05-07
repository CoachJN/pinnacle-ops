import { NextRequest } from "next/server";
import {
  getWorkOrderApiContext,
  parseJsonObject,
  withApiRoute,
} from "@/server/api/work-orders";
import {
  addRuntimeWorkOrderNote,
  listRuntimeWorkOrderNotes,
} from "@/server/api/work-order-runtime";

interface RouteContext {
  params: Promise<{ workOrderId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]/notes",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      const { workOrderId } = await params;
      return listRuntimeWorkOrderNotes(context, workOrderId);
    },
  );
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]/notes",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      const { workOrderId } = await params;
      return addRuntimeWorkOrderNote(context, workOrderId, await parseJsonObject(request));
    },
  );
}
