import { NextRequest } from "next/server";
import { createSlaRuntimeOperatorService } from "@/modules/sla";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/sla/operator/diagnostics", async (requestContext) => {
    const context = await getRuntimeApiContext(requestContext);
    const operator = createSlaRuntimeOperatorService({
      repositories: {
        runtimeJobs: context.repositories.runtimeJobs,
        runtimeDeadLetters: context.repositories.runtimeDeadLetters,
        slaTimers: context.repositories.slaTimers,
        slaScanCursors: context.repositories.slaScanCursors,
      },
      services: {
        runtime: context.services.runtime,
        sla: context.services.sla,
      },
    });

    const limitParam = request.nextUrl.searchParams.get("limit")?.trim() || null;
    const dueBefore = request.nextUrl.searchParams.get("dueBefore")?.trim() || undefined;
    const timerType = request.nextUrl.searchParams.get("timerType")?.trim() || undefined;
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;

    const result = await operator.getDiagnostics({
      organizationId: context.actor.scope.organizationId,
      dueBefore,
      timerType,
      limit: Number.isFinite(limit) ? limit : 20,
    });
    if (!result.ok) {
      throw result.error;
    }

    return jsonOk({ data: result.value });
  });
}
