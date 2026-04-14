import { NextRequest } from "next/server";
import {
  updatePhaseThreeWorkOrderStatus,
  withPhaseThreeWorkOrderRoute,
} from "@/server/api/work-order-core";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return withPhaseThreeWorkOrderRoute(
    request,
    "/api/work-orders/[id]/status",
    async (context) => {
      const { id } = await params;
      return updatePhaseThreeWorkOrderStatus(context, request, id);
    },
  );
}
