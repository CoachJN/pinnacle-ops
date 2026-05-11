import "server-only";

import type { WorkerHandlerDefinition } from "@/modules/runtime";
import type { RuntimeObservabilityRepositories } from "@/modules/operations";
import { createRuntimeOperationsPlatform } from "@/modules/operations/server/runtime-operations-factory";
import type { FirestoreRepositories } from "@/server/repositories";
import type { DomainServices } from "@/server/services";

export function createRuntimeHealthRefreshHandler(
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
    type: "runtime.health.refresh",
    description: "Refreshes canonical runtime health aggregation and deduplicated alerts.",
    async handle(context) {
      if (context.payload.payloadVersion !== "v1") {
        return {
          success: false,
          retryable: false,
          message: "Unsupported runtime health refresh payload version.",
          errorCode: "runtime_health_refresh_payload_version_invalid",
          errorDetails: {},
        };
      }

      const operations = createRuntimeOperationsPlatform(
        repositories,
        services,
        observabilityRepositories,
      );
      const summary = await operations.commandCenter.getSummary({
        organizationId: context.organizationId,
        now: context.startedAt,
      });
      return {
        success: true,
        message: `Runtime health refreshed for ${context.organizationId}.`,
        metadata: {
          healthStatus: summary.health.status,
          alertCount: summary.activeAlerts.length,
          generatedAt: summary.projection.generatedAt,
        },
      };
    },
  };
}
