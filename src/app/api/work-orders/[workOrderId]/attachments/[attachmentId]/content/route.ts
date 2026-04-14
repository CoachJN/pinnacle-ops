import { NextRequest } from "next/server";
import {
  accessPhaseThreeWorkOrderAttachmentContent,
  withPhaseThreeWorkOrderRoute,
} from "@/server/api/work-order-core";

interface RouteContext {
  params: Promise<{ workOrderId: string; attachmentId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  return withPhaseThreeWorkOrderRoute(
    request,
    "/api/work-orders/[workOrderId]/attachments/[attachmentId]/content",
    async (context) => {
      const { workOrderId, attachmentId } = await params;
      return accessPhaseThreeWorkOrderAttachmentContent(
        context,
        workOrderId,
        attachmentId,
      );
    },
  );
}
