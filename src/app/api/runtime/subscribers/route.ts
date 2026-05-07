import { NextRequest } from "next/server";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/runtime/subscribers", async (requestContext) => {
    const context = await getRuntimeApiContext(requestContext);
    const limitParam = request.nextUrl.searchParams.get("limit")?.trim() || null;
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 50;

    const records = await context.services.runtime.subscribers.listProcessingRecords({
      organizationId: context.actor.scope.organizationId,
      limit: Number.isFinite(limit) ? limit : 50,
    });
    if (!records.ok) {
      throw records.error;
    }

    return jsonOk({
      data: {
        subscribers: context.services.runtime.subscribers.listRegistered(),
        processingRecords: records.value,
      },
    });
  });
}
