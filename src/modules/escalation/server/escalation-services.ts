import "server-only";

import type { FirestoreRepositories } from "@/server/repositories";
import type { DomainEventService } from "@/server/services";
import {
  createEscalationDiagnosticsService,
  type EscalationDiagnosticsService,
} from "./escalation-diagnostics-service";
import {
  createEscalationOrchestrationRepository,
  type EscalationOrchestrationRepository,
} from "./escalation-orchestration-repository";
import {
  createEscalationPolicyService,
  type EscalationPolicyService,
} from "./escalation-policy-service";
import {
  createEscalationProgressionService,
  type EscalationProgressionService,
} from "./escalation-progression-service";
import {
  createEscalationRuntimeService,
  type EscalationRuntimeService,
} from "./escalation-runtime-service";
import {
  createEscalationSchedulerService,
  type EscalationSchedulerService,
} from "./escalation-scheduler-service";
import {
  createEscalationSuppressionService,
  type EscalationSuppressionService,
} from "./escalation-suppression-service";

export interface EscalationDomainServices {
  repository: EscalationOrchestrationRepository;
  policy: EscalationPolicyService;
  scheduler: EscalationSchedulerService;
  suppression: EscalationSuppressionService;
  progression: EscalationProgressionService;
  runtime: EscalationRuntimeService;
  diagnostics: EscalationDiagnosticsService;
}

export function createEscalationServices(
  repositories: Pick<
    FirestoreRepositories,
    "escalationOrchestrations" | "domainEvents" | "slaTimers" | "workOrders"
  >,
  dependencies: {
    domainEvents: DomainEventService;
  },
): EscalationDomainServices {
  const repository = createEscalationOrchestrationRepository(repositories);
  const policy = createEscalationPolicyService();
  const scheduler = createEscalationSchedulerService(repository, policy);
  const suppression = createEscalationSuppressionService(repository);
  const progression = createEscalationProgressionService(
    repositories,
    repository,
    policy,
    scheduler,
    dependencies.domainEvents,
  );
  const runtime = createEscalationRuntimeService(
    repositories,
    repository,
    policy,
    suppression,
    progression,
    dependencies.domainEvents,
  );
  const diagnostics = createEscalationDiagnosticsService(repositories, repository);

  return {
    repository,
    policy,
    scheduler,
    suppression,
    progression,
    runtime,
    diagnostics,
  };
}
