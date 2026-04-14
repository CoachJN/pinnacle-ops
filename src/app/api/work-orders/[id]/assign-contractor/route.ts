import { NextRequest } from "next/server";
import {
  authorizeWorkOrderEdit,
  getWorkOrderApiContext,
  jsonOk,
  parseAssignContractorPayload,
  parseJsonObject,
  revalidateWorkOrderPaths,
  safeWorkOrderDetail,
  withApiRoute,
} from "@/server/api/work-orders";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[id]/assign-contractor",
    async (requestContext) => {
    const { id } = await params;
    const context = await getWorkOrderApiContext(requestContext);
    const existing = await context.services.workOrders.getById(id);

    if (!existing.ok) {
      throw existing.error;
    }

    authorizeWorkOrderEdit(context, existing.value);

    const input = parseAssignContractorPayload(await parseJsonObject(request));
    const result = input.contractorOrganizationId
      ? await context.services.assignments.assign({
          ...context.audit,
          workOrderId: id,
          contractorOrganizationId: input.contractorOrganizationId,
        })
      : await context.services.workOrders.assignContractor({
          ...context.audit,
          workOrderId: id,
          contractorOrganizationId: null,
        });

    if (!result.ok) {
      throw result.error;
    }

    const workOrder = await context.services.workOrders.getById(id);
    if (!workOrder.ok) {
      throw workOrder.error;
    }

    revalidateWorkOrderPaths(workOrder.value.id);

    return jsonOk({ workOrder: safeWorkOrderDetail(workOrder.value) });
    },
  );
}
