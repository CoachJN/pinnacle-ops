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
  params: Promise<{ workOrderId: string }>;
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]/assign-contractor",
    async (requestContext) => {
    const { workOrderId } = await params;
    const context = await getWorkOrderApiContext(requestContext);
    const existing = await context.services.workOrders.getById(workOrderId);

    if (!existing.ok) {
      throw existing.error;
    }

    authorizeWorkOrderEdit(context, existing.value);

    const input = parseAssignContractorPayload(await parseJsonObject(request));
    const result = input.contractorOrganizationId
      ? await context.services.assignments.assign({
          ...context.audit,
          workOrderId,
          contractorOrganizationId: input.contractorOrganizationId,
        })
      : await context.services.workOrders.assignContractor({
          ...context.audit,
          workOrderId,
          contractorOrganizationId: null,
        });

    if (!result.ok) {
      throw result.error;
    }

    const workOrder = await context.services.workOrders.getById(workOrderId);
    if (!workOrder.ok) {
      throw workOrder.error;
    }

    revalidateWorkOrderPaths(workOrder.value.id);

    return jsonOk({ data: { workOrder: safeWorkOrderDetail(workOrder.value) } });
    },
  );
}
