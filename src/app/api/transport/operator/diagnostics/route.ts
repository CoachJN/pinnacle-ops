import { NextRequest } from "next/server";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/transport/operator/diagnostics", async (requestContext) => {
    const context = await getRuntimeApiContext(requestContext);
    const limitParam = request.nextUrl.searchParams.get("limit")?.trim() || null;
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;

    const result = await context.services.transport.diagnostics.getSummary({
      organizationId: context.actor.scope.organizationId,
      limit: Number.isFinite(limit) ? limit : 20,
    });
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({ data: result.value });
  });
}
