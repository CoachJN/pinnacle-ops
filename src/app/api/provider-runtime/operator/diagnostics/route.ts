import { NextRequest } from "next/server";
import { getProviderRuntimeApiContext } from "@/server/api/provider-runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/provider-runtime/operator/diagnostics", async (requestContext) => {
    const context = await getProviderRuntimeApiContext(requestContext);
    const limitParam = request.nextUrl.searchParams.get("limit")?.trim() || null;
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 25;
    const summary = await context.services.providerRuntime.diagnostics.getSummary({
      organizationId: context.actor.scope.organizationId,
      limit: Number.isFinite(limit) ? limit : 25,
    });
    if (!summary.ok) {
      throw summary.error;
    }

    return jsonOk({ data: summary.value });
  });
}
