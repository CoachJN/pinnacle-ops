import { NextRequest } from "next/server";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";
import { createRuntimeOperationsPlatform } from "@/modules/operations/server/runtime-operations-factory";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/operations/runtime/health", async (requestContext) => {
    const context = await getRuntimeApiContext(requestContext);
    const operations = createRuntimeOperationsPlatform(
      {
        domainEvents: context.repositories.domainEvents,
        runtimeJobs: context.repositories.runtimeJobs,
        runtimeDeadLetters: context.repositories.runtimeDeadLetters,
        runtimeEventProcessings: context.repositories.runtimeEventProcessings,
        deliveryPlans: context.repositories.deliveryPlans,
        deliveryAttempts: context.repositories.deliveryAttempts,
        escalationOrchestrations: context.repositories.escalationOrchestrations,
        slaTimers: context.repositories.slaTimers,
      },
      {
        runtime: context.services.runtime,
        providerRuntime: context.services.providerRuntime,
        delivery: context.services.delivery,
      },
    );
    const now = request.nextUrl.searchParams.get("now")?.trim() || new Date().toISOString();
    const refreshed = await operations.projection.refresh({
      organizationId: context.actor.scope.organizationId,
      now,
    });
    const health = operations.health.evaluate({
      projection: refreshed.projection,
      now,
    });
    await operations.alerts.sync({
      projection: refreshed.projection,
      now,
    });
    return jsonOk({ data: health });
  });
}
