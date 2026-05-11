import "server-only";

import type { ProviderRuntimeStorage } from "@/modules/provider-runtime";
import type { RuntimeProjectionRepository, RuntimeRepairActionRepository } from "@/modules/operations/server/runtime-observability-repository";
import { createProviderIsolationService } from "./provider-isolation-service";
import { createRuntimeArchivalService } from "./runtime-archival-service";
import { createRuntimeBackpressureService } from "./runtime-backpressure-service";
import { createRuntimeCapacityDiagnosticsService } from "./runtime-capacity-diagnostics-service";
import { createRuntimeCapacityGuardrailService } from "./runtime-capacity-guardrail-service";
import { createRuntimeFairnessService } from "./runtime-fairness-service";
import {
  createRuntimeQuotaService,
  type RuntimeCapacityDataSources,
  type RuntimeCapacityRepositories,
} from "./runtime-quota-service";
import { createRuntimeRetentionService } from "./runtime-retention-service";

export function createRuntimeCapacityServices(input: {
  repositories: RuntimeCapacityRepositories;
  providerRuntimeStorage?: ProviderRuntimeStorage;
  observability?: {
    repairActions?: Pick<RuntimeRepairActionRepository, "listByOrganizationId">;
    projections?: Pick<RuntimeProjectionRepository, "getByOrganizationId">;
  };
}) {
  const sources: RuntimeCapacityDataSources = {
    repositories: input.repositories,
    providerRuntimeStorage: input.providerRuntimeStorage,
    observability: input.observability,
  };
  const quota = createRuntimeQuotaService(sources);
  const fairness = createRuntimeFairnessService();
  const providerIsolation = createProviderIsolationService(quota);
  const backpressure = createRuntimeBackpressureService(quota, providerIsolation);
  const retention = createRuntimeRetentionService(sources, quota);
  const archival = createRuntimeArchivalService(retention);
  const diagnostics = createRuntimeCapacityDiagnosticsService(
    quota,
    fairness,
    backpressure,
    providerIsolation,
    retention,
    archival,
  );
  const guardrails = createRuntimeCapacityGuardrailService(quota, backpressure, providerIsolation);

  return {
    quota,
    fairness,
    providerIsolation,
    backpressure,
    retention,
    archival,
    diagnostics,
    guardrails,
  };
}
