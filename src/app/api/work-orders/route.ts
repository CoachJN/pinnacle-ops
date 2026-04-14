import { NextRequest } from "next/server";
import {
  createPhaseThreeWorkOrder,
  listPhaseThreeWorkOrders,
  withPhaseThreeWorkOrderRoute,
} from "@/server/api/work-order-core";

export async function GET(request: NextRequest) {
  return withPhaseThreeWorkOrderRoute(
    request,
    "/api/work-orders",
    async (context) => listPhaseThreeWorkOrders(context, request),
  );
}

export async function POST(request: NextRequest) {
  return withPhaseThreeWorkOrderRoute(
    request,
    "/api/work-orders",
    async (context) => createPhaseThreeWorkOrder(context, request),
  );
}
