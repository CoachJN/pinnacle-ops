import { NextRequest } from "next/server";
import { createRuntimeCapacityServices } from "@/modules/runtime-capacity";
import { createFirestoreRuntimeObservabilityRepositories } from "@/modules/operations/server/runtime-observability-repository";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/runtime-capacity/retention", async (requestContext) => {
    const context = await getRuntimeApiContext(requestContext);
    const now = request.nextUrl.searchParams.get("now")?.trim() || new Date().toISOString();
    const runtimeCapacity = createRuntimeCapacityServices({
      repositories: {
        runtimeJobs: context.repositories.runtimeJobs,
        runtimeDeadLetters: context.repositories.runtimeDeadLetters,
        deliveryAttempts: context.repositories.deliveryAttempts,
        escalationOrchestrations: context.repositories.escalationOrchestrations,
      },
      providerRuntimeStorage: context.services.providerRuntime.storage,
      observability: createFirestoreRuntimeObservabilityRepositories(),
    });
    const [retention, archival] = await Promise.all([
      runtimeCapacity.retention.getSummary({
        organizationId: context.actor.scope.organizationId,
        tenantId: context.actor.scope.organizationId,
        now,
      }),
      runtimeCapacity.archival.getSummary({
        organizationId: context.actor.scope.organizationId,
        tenantId: context.actor.scope.organizationId,
        now,
      }),
    ]);
    return jsonOk({
      data: {
        retention,
        archival,
      },
    });
  });
}
