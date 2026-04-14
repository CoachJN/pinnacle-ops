import { NextRequest } from "next/server";
import {
  addPhaseThreeWorkOrderAttachment,
  listPhaseThreeWorkOrderAttachments,
  withPhaseThreeWorkOrderRoute,
} from "@/server/api/work-order-core";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  return withPhaseThreeWorkOrderRoute(
    request,
    "/api/work-orders/[id]/attachments",
    async (context) => {
      const { id } = await params;
      return listPhaseThreeWorkOrderAttachments(context, id);
    },
  );
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withPhaseThreeWorkOrderRoute(
    request,
    "/api/work-orders/[id]/attachments",
    async (context) => {
      const { id } = await params;
      return addPhaseThreeWorkOrderAttachment(context, request, id);
    },
  );
}
