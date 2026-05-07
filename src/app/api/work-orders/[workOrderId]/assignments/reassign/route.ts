import { NextRequest, NextResponse } from "next/server";
import { reassignContractorAssignmentSchema } from "@/modules/work-orders";

import {
  getWorkOrderApiContext,
  parseJsonObject,
  revalidateWorkOrderPaths,
  withApiRoute,
} from "@/server/api/work-orders";
import {
  getRuntimeWorkOrderDetail,
  getRuntimeWorkOrderDetailData,
} from "@/server/api/work-order-runtime";
import { createAccessDeniedError } from "@/server/authorization";

interface RouteContext {
  params: Promise<{ workOrderId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]/assignments/reassign",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      const { workOrderId } = await params;
      if (context.actor.actorType !== "internal") {
        throw createAccessDeniedError();
      }
      await getRuntimeWorkOrderDetail(context, workOrderId);
      const payload = reassignContractorAssignmentSchema.parse(
        await parseJsonObject(request),
      );

      const result = await context.services.assignments.reassignContractor({
        ...context.audit,
        workOrderId,
        currentAssignmentId: payload.currentAssignmentId,
        contractorOrganizationId: payload.contractorOrganizationId,
        scheduledDate: payload.scheduledDate,
        timeWindowStart: payload.timeWindowStart,
        timeWindowEnd: payload.timeWindowEnd,
        notes: payload.notes,
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
