import { NextRequest } from "next/server";
import {
  updatePhaseThreeWorkOrderStatus,
  withPhaseThreeWorkOrderRoute,
} from "@/server/api/work-order-core";

interface RouteContext {
  params: Promise<{ workOrderId: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return withPhaseThreeWorkOrderRoute(
    request,
    "/api/work-orders/[workOrderId]/status",
    async (context) => {
      const { workOrderId } = await params;
      return updatePhaseThreeWorkOrderStatus(context, request, workOrderId);
    },
  );
}
