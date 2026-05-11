import { NextRequest } from "next/server";
import {
  createFirestoreSchedulerRepositories,
  createRuntimeSchedulerService,
  createSchedulerDiagnosticsService,
} from "@/modules/scheduler";
import { createRuntimeCapacityServices } from "@/modules/runtime-capacity";
import { getRuntimeApiContext } from "@/server/api/runtime";
import { jsonOk, withApiRoute } from "@/server/api/work-orders";

export async function GET(request: NextRequest) {
  return withApiRoute(request, "/api/scheduler/operator/diagnostics", async (requestContext) => {
    const context = await getRuntimeApiContext(requestContext);
    const now = request.nextUrl.searchParams.get("now")?.trim() || new Date().toISOString();
    const repositories = createFirestoreSchedulerRepositories();
    const runtimeCapacity = createRuntimeCapacityServices({
      repositories: {
        runtimeJobs: context.repositories.runtimeJobs,
        runtimeDeadLetters: context.repositories.runtimeDeadLetters,
        deliveryAttempts: context.repositories.deliveryAttempts,
        escalationOrchestrations: context.repositories.escalationOrchestrations,
      },
      providerRuntimeStorage: context.services.providerRuntime.storage,
    });
    const scheduler = createRuntimeSchedulerService(
      repositories,
      context.services.runtime,
      runtimeCapacity.guardrails,
    );
    const diagnostics = createSchedulerDiagnosticsService(repositories, scheduler);
    const data = await diagnostics.getDiagnostics({
      organizationId: context.actor.scope.organizationId,
      now,
    });
    return jsonOk({ data });
  });
}
