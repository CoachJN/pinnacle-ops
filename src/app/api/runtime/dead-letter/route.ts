import { NextRequest } from "next/server";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/runtime/dead-letter", async (requestContext) => {
    const context = await getRuntimeApiContext(requestContext);
    const limitParam = request.nextUrl.searchParams.get("limit")?.trim() || null;
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 100;
    const result = await context.services.runtime.deadLetters.listByOrganizationId({
      organizationId: context.actor.scope.organizationId,
      limit: Number.isFinite(limit) ? limit : 100,
    });
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({
      data: {
        deadLetters: result.value,
      },
    });
  });
}
