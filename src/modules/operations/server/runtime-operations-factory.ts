import "server-only";

import type { FirestoreRepositories } from "@/server/repositories";
import type { DomainServices } from "@/server/services";
import { createOperatorGuardrailService } from "@/modules/scheduler/server/operator-guardrail-service";
import type { SchedulerRepositories } from "@/modules/scheduler/server/scheduler-task-repository";
import { createFirestoreSchedulerRepositories } from "@/modules/scheduler/server/scheduler-task-repository";
import { createRuntimeAlertService } from "./runtime-alert-service";
import { createRuntimeAuditService } from "./runtime-audit-service";
import { createRuntimeCommandCenterService } from "./runtime-command-center-service";
import { createDeadLetterOperationsService } from "./dead-letter-operations-service";
import { createRuntimeHealthService } from "./runtime-health-service";
import {
  createFirestoreRuntimeObservabilityRepositories,
  type RuntimeObservabilityRepositories,
} from "./runtime-observability-repository";
import { createRuntimeObservabilityService } from "./runtime-observability-service";
import { createRuntimeProjectionService } from "./runtime-projection-service";
import { createRuntimeRepairService } from "./runtime-repair-service";
import { createReplayOperationsService } from "./replay-operations-service";

export function createRuntimeOperationsPlatform(
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
  observabilityRepositories: RuntimeObservabilityRepositories = createFirestoreRuntimeObservabilityRepositories(),
  schedulerRepositories: SchedulerRepositories = createFirestoreSchedulerRepositories(),
) {
  const health = createRuntimeHealthService();
  const projection = createRuntimeProjectionService(
    repositories,
    services.providerRuntime,
    observabilityRepositories,
    health,
  );
  const alerts = createRuntimeAlertService(observabilityRepositories);
  const audit = createRuntimeAuditService(observabilityRepositories);
  const deadLetters = createDeadLetterOperationsService(repositories);
  const replay = createReplayOperationsService(repositories, services.providerRuntime);
  const commandCenter = createRuntimeCommandCenterService(projection, health, alerts);
  const guardrails = createOperatorGuardrailService(schedulerRepositories);
  const observability = createRuntimeObservabilityService(
    repositories,
    projection,
    health,
    alerts,
    audit,
    deadLetters,
    replay,
  );
  const repair = createRuntimeRepairService(
    repositories,
    services,
    observabilityRepositories,
    schedulerRepositories,
    guardrails,
  );

  return {
    repositories: observabilityRepositories,
    schedulerRepositories,
    health,
    projection,
    alerts,
    audit,
    deadLetters,
    replay,
    commandCenter,
    observability,
    repair,
  };
}
