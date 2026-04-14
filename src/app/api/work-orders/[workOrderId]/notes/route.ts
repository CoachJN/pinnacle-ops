import { NextRequest } from "next/server";
import {
  addPhaseThreeWorkOrderNote,
  listPhaseThreeWorkOrderNotes,
  withPhaseThreeWorkOrderRoute,
} from "@/server/api/work-order-core";

interface RouteContext {
  params: Promise<{ workOrderId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  return withPhaseThreeWorkOrderRoute(
    request,
    "/api/work-orders/[workOrderId]/notes",
    async (context) => {
      const { workOrderId } = await params;
      return listPhaseThreeWorkOrderNotes(context, workOrderId);
    },
  );
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withPhaseThreeWorkOrderRoute(
    request,
    "/api/work-orders/[workOrderId]/notes",
    async (context) => {
      const { workOrderId } = await params;
      return addPhaseThreeWorkOrderNote(context, request, workOrderId);
    },
  );
}
