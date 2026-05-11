import { NextRequest } from "next/server";
import {
  authorizeWorkOrderEdit,
  createNotFoundAppError,
  getWorkOrderApiContext,
  parseJsonObject,
  parseUpdateWorkOrderPayload,
  revalidateWorkOrderPaths,
  withApiRoute,
} from "@/server/api/work-orders";
import { createAccessDeniedError } from "@/server/authorization";
import { getRuntimeWorkOrderDetail } from "@/server/api/work-order-runtime";

interface RouteContext {
  params: Promise<{ workOrderId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    _request,
    "/api/work-orders/[workOrderId]",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      const { workOrderId } = await params;
      return getRuntimeWorkOrderDetail(context, workOrderId);
    },
  );
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  return withApiRoute(
    request,
    "/api/work-orders/[workOrderId]",
    async (requestContext) => {
      const context = await getWorkOrderApiContext(requestContext);
      if (context.actor.actorType !== "internal") {
        throw createAccessDeniedError("Operational work-order runtime endpoints are restricted to internal users.");
      }
      const { workOrderId } = await params;
      const existing = await context.repositories.workOrders.getById(workOrderId);
      if (!existing) {
        throw createNotFoundAppError("Work order could not be found.");
      }
      authorizeWorkOrderEdit(context, existing);
      const payload = parseUpdateWorkOrderPayload(await parseJsonObject(request));
      const result = await context.services.workOrders.update({
        ...context.audit,
        workOrderId,
        ...payload,
      });

      if (!result.ok) {
        throw result.error;
      }

      revalidateWorkOrderPaths(workOrderId);
      return getRuntimeWorkOrderDetail(context, workOrderId);
    },
  );
}
