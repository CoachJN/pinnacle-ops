import { NextRequest } from "next/server";
import { createRuntimeLoopRuntime } from "@/modules/runtime-loops/server/runtime-loop-runtime";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/runtime-loops/health", async (requestContext) => {
    const context = await getRuntimeApiContext(requestContext);
    const runtimeLoops = createRuntimeLoopRuntime(context);
    const now = request.nextUrl.searchParams.get("now")?.trim() || new Date().toISOString();
    const data = await runtimeLoops.services.health.getHealth({
      organizationId: context.actor.scope.organizationId,
      now,
    });
    return jsonOk({ data });
  });
}
