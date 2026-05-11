import "server-only";

import type { WorkerHandlerDefinition } from "@/modules/runtime";
import type { RuntimeObservabilityRepositories } from "@/modules/operations";
import { createRuntimeOperationsPlatform } from "@/modules/operations/server/runtime-operations-factory";
import type { FirestoreRepositories } from "@/server/repositories";
import type { DomainServices } from "@/server/services";

export function createProjectionRefreshHandler(
  repositories: Pick<
    FirestoreRepositories,
    | "domainEvents"
    | "runtimeJobs"
    | "runtimeDeadLetters"
    | "runtimeEventProcessings"
    | "deliveryPlans"
    | "deliveryAttempts"
    | "escalationOrchestrations"
    | "slaTimers"
  >,
  services: Pick<DomainServices, "runtime" | "providerRuntime" | "delivery">,
  observabilityRepositories?: RuntimeObservabilityRepositories,
): WorkerHandlerDefinition<DomainServices> {
  return {
    type: "operations.projection.refresh",
    description: "Refreshes canonical runtime command-center projections from persisted runtime state.",
    async handle(context) {
      if (context.payload.payloadVersion !== "v1") {
        return {
          success: false,
          retryable: false,
          message: "Unsupported projection refresh payload version.",
          errorCode: "projection_refresh_payload_version_invalid",
          errorDetails: {},
        };
      }

      const operations = createRuntimeOperationsPlatform(
        repositories,
        services,
        observabilityRepositories,
      );
      const refreshed = await operations.projection.refresh({
        organizationId: context.organizationId,
        now: context.startedAt,
      });
      return {
        success: true,
        message: `Runtime projection refreshed for ${context.organizationId}.`,
        metadata: {
          projectionId: refreshed.projection.id,
          generatedAt: refreshed.projection.generatedAt,
          queueLagMs: refreshed.projection.queue.queueLagMs,
        },
      };
    },
  };
}
