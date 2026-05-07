import { NextRequest } from "next/server";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

interface RouteContext {
  params: Promise<{ jobId: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteContext) {
  return withApiRoute(_request, "/api/runtime/jobs/[jobId]", async (requestContext) => {
    const context = await getRuntimeApiContext(requestContext);
    const { jobId } = await params;
    const result = await context.services.runtime.jobs.getJob({
      organizationId: context.actor.scope.organizationId,
      jobId,
    });
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({
      data: result.value,
    });
  });
}
