import { NextRequest } from "next/server";
import {
  addPhaseThreeWorkOrderAttachment,
  listPhaseThreeWorkOrderAttachments,
  withPhaseThreeWorkOrderRoute,
} from "@/server/api/work-order-core";

interface RouteContext {
  params: Promise<{ workOrderId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  return withPhaseThreeWorkOrderRoute(
    request,
    "/api/work-orders/[workOrderId]/attachments",
    async (context) => {
      const { workOrderId } = await params;
      return listPhaseThreeWorkOrderAttachments(context, workOrderId);
    },
  );
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withPhaseThreeWorkOrderRoute(
    request,
    "/api/work-orders/[workOrderId]/attachments",
    async (context) => {
      const { workOrderId } = await params;
      return addPhaseThreeWorkOrderAttachment(context, request, workOrderId);
    },
  );
}
