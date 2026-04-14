import { NextRequest, NextResponse } from "next/server";
import { createContractorAssignmentSchema } from "@/modules/work-orders";

import {
  getPhaseThreeWorkOrderApiContext,
  getSerializedPhaseThreeWorkOrderDetail,
} from "@/server/api/work-order-core";
import {
  parseJsonObject,
  revalidateWorkOrderPaths,
  withApiRoute,
} from "@/server/api/work-orders";
import { createAccessDeniedError } from "@/server/authorization";

interface RouteContext {
  params: Promise<{ workOrderId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(request, "/api/work-orders/[workOrderId]/assignments", async (requestContext) => {
    const context = await getPhaseThreeWorkOrderApiContext(requestContext);
    const { workOrderId } = await params;
    if (context.actor.actorType !== "internal") {
      throw createAccessDeniedError();
    }
    await getSerializedPhaseThreeWorkOrderDetail(context, workOrderId);
    const payload = createContractorAssignmentSchema.parse(
      await parseJsonObject(request),
    );

    const result = await context.services.assignments.assignContractor({
      ...context.audit,
      workOrderId,
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

    return NextResponse.json(
      {
        data: {
          workOrder: await getSerializedPhaseThreeWorkOrderDetail(context, workOrderId),
        },
      },
      { status: 201 },
    );
  });
}
