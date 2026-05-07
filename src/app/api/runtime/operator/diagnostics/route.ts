import { NextRequest } from "next/server";
import { createRuntimeOperatorContext, getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/runtime/operator/diagnostics", async (requestContext) => {
    const baseContext = await getRuntimeApiContext(requestContext);
    const context = createRuntimeOperatorContext(baseContext);
    const limitParam = request.nextUrl.searchParams.get("limit")?.trim() || null;
    const limit = limitParam ? Number.parseInt(limitParam, 10) : 20;

    const result = await context.operator.getDiagnostics({
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
