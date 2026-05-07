import { NextRequest } from "next/server";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/runtime/jobs", async (requestContext) => {
    const context = await getRuntimeApiContext(requestContext);
    const status = request.nextUrl.searchParams.get("status")?.trim() || null;
    const type = request.nextUrl.searchParams.get("type")?.trim() || null;
    const limitParam = request.nextUrl.searchParams.get("limit")?.trim() || null;
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 100;

    const result = await context.services.runtime.jobs.listJobs({
      organizationId: context.actor.scope.organizationId,
      status: status as never,
      type,
      limit: Number.isFinite(limit) ? limit : 100,
    });
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({
      data: {
        jobs: result.value,
      },
    });
  });
}
