import { NextRequest } from "next/server";
import { authorizeOperationalRuntimeAccess } from "@/server/api/provider-runtime";
import { getWorkOrderApiContext, jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/sla/diagnostics", async (requestContext) => {
    const context = await getWorkOrderApiContext(requestContext);
    authorizeOperationalRuntimeAccess(context);

    const limitParam = request.nextUrl.searchParams.get("limit")?.trim() || null;
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;
    const result = await context.services.sla.diagnostics.getSummary({
      organizationId: context.actor.scope.organizationId,
      limit: Number.isFinite(limit) ? limit : 20,
    });
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({
      data: result.value,
    });
  });
}
