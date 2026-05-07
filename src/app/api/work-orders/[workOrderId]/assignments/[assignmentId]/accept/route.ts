import { NextRequest, NextResponse } from "next/server";

import {
  getWorkOrderApiContext,
  revalidateWorkOrderPaths,
  withApiRoute,
} from "@/server/api/work-orders";
import {
  getRuntimeWorkOrderDetail,
  getRuntimeWorkOrderDetailData,
} from "@/server/api/work-order-runtime";

interface RouteContext {
  params: Promise<{ workOrderId: string; assignmentId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]/assignments/[assignmentId]/accept",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      const { workOrderId, assignmentId } = await params;
      await getRuntimeWorkOrderDetail(context, workOrderId);

      const result = await context.services.assignments.updateStatus({
        ...context.audit,
        workOrderId,
        assignmentId,
        status: "accepted",
      });

      if (!result.ok) {
        throw result.error;
      }

      revalidateWorkOrderPaths(workOrderId);

      return NextResponse.json({
        data: {
          workOrder: await getRuntimeWorkOrderDetailData(context, workOrderId),
        },
      });
    },
  );
}
