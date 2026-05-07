import { NextRequest } from "next/server";
import {
  getWorkOrderApiContext,
  parseJsonObject,
  withApiRoute,
} from "@/server/api/work-orders";
import {
  addRuntimeWorkOrderAttachment,
  listRuntimeWorkOrderAttachments,
} from "@/server/api/work-order-runtime";

interface RouteContext {
  params: Promise<{ workOrderId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]/attachments",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      const { workOrderId } = await params;
      return listRuntimeWorkOrderAttachments(context, workOrderId);
    },
  );
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]/attachments",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      const { workOrderId } = await params;
      return addRuntimeWorkOrderAttachment(
        context,
        workOrderId,
        await parseJsonObject(request),
      );
    },
  );
}
