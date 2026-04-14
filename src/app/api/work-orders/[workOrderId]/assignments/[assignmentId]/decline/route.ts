import { NextRequest, NextResponse } from "next/server";

import {
  getPhaseThreeWorkOrderApiContext,
  getSerializedPhaseThreeWorkOrderDetail,
} from "@/server/api/work-order-core";
import {
  parseJsonObject,
  revalidateWorkOrderPaths,
  withApiRoute,
} from "@/server/api/work-orders";

interface RouteContext {
  params: Promise<{ workOrderId: string; assignmentId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]/assignments/[assignmentId]/decline",
    async (requestContext) => {
      const context = await getPhaseThreeWorkOrderApiContext(requestContext);
      const { workOrderId, assignmentId } = await params;
      await getSerializedPhaseThreeWorkOrderDetail(context, workOrderId);
      const payload = await parseJsonObject(request);

      const result = await context.services.assignments.updateStatus({
        ...context.audit,
        workOrderId,
        assignmentId,
        status: "declined",
        notes:
          typeof payload.notes === "string" ? payload.notes : null,
      });

      if (!result.ok) {
        throw result.error;
      }

      revalidateWorkOrderPaths(workOrderId);

      return NextResponse.json({
        data: {
          workOrder: await getSerializedPhaseThreeWorkOrderDetail(context, workOrderId),
        },
      });
    },
  );
}
