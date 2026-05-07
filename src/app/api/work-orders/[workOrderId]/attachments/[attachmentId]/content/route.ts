import { NextRequest } from "next/server";
import {
  getWorkOrderApiContext,
  withApiRoute,
} from "@/server/api/work-orders";
import { accessRuntimeWorkOrderAttachmentContent } from "@/server/api/work-order-runtime";

interface RouteContext {
  params: Promise<{ workOrderId: string; attachmentId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]/attachments/[attachmentId]/content",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      const { workOrderId, attachmentId } = await params;
      return accessRuntimeWorkOrderAttachmentContent(
        context,
        workOrderId,
        attachmentId,
      );
    },
  );
}
