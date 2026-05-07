import { NextRequest } from "next/server";
import { getProviderRuntimeApiContext } from "@/server/api/provider-runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/providers/sync-runs", async (requestContext) => {
    const context = await getProviderRuntimeApiContext(requestContext);
    const connectionId = request.nextUrl.searchParams.get("connectionId")?.trim() || null;
    const result = await context.services.providers.diagnostics.listRecentSyncRuns({
      organizationId: context.actor.scope.organizationId,
      connectionId,
      limit: 50,
    });
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({
      data: {
        syncRuns: result.value,
      },
    });
  });
}
