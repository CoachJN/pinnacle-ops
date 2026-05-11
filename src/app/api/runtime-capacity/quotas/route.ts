import { NextRequest } from "next/server";
import { createRuntimeCapacityServices } from "@/modules/runtime-capacity";
import { createFirestoreRuntimeObservabilityRepositories } from "@/modules/operations/server/runtime-observability-repository";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/runtime-capacity/quotas", async (requestContext) => {
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
    const tenantId = context.actor.scope.organizationId;
    const snapshot = await runtimeCapacity.quota.buildSnapshot({
      organizationId: context.actor.scope.organizationId,
      tenantId,
      now,
    });

    return jsonOk({
      data: {
        tenantId,
        quota: runtimeCapacity.quota.getQuota({ tenantId }),
        utilization: snapshot.utilization,
      },
    });
  });
}
