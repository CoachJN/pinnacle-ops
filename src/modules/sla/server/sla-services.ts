import "server-only";

import type { FirestoreRepositories } from "@/server/repositories";
import type { DomainEventService } from "@/server/services";
import {
  createSlaDiagnosticsService,
  type SlaDiagnosticsService,
} from "./sla-diagnostics-service";
import {
  createSlaEvaluatorService,
  type SlaEvaluatorService,
} from "./sla-evaluator-service";
import {
  createSlaSchedulerService,
  type SlaSchedulerService,
} from "./sla-scheduler-service";
import {
  createSlaTimerRepository,
  type SlaTimerRepository,
} from "./sla-timer-repository";
import {
  createSlaTimerService,
  type SlaTimerService,
} from "./sla-timer-service";

export interface SlaDomainServices {
  repository: SlaTimerRepository;
  timers: SlaTimerService;
  scheduler: SlaSchedulerService;
  evaluator: SlaEvaluatorService;
  diagnostics: SlaDiagnosticsService;
}

export function createSlaServices(
  repositories: Pick<FirestoreRepositories, "slaTimers" | "workOrders" | "domainEvents">,
  dependencies: {
    domainEvents: DomainEventService;
  },
): SlaDomainServices {
  const repository = createSlaTimerRepository(repositories);
  const timers = createSlaTimerService(repository);
  const scheduler = createSlaSchedulerService(timers);
  const evaluator = createSlaEvaluatorService(repositories, timers, dependencies.domainEvents);
  const diagnostics = createSlaDiagnosticsService(repository);

  return {
    repository,
    timers,
    scheduler,
    evaluator,
    diagnostics,
  };
}
