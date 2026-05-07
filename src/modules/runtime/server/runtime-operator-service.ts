import "server-only";

import type {
  EventProcessingResult,
  RuntimeOperatorDiagnostics,
  WorkerJob,
  WorkerRunnerBatchResult,
} from "@/modules/runtime";
import { serviceOk, type ServiceActor, type ServiceResult } from "@/server/services";
import type { FirestoreRepositories } from "@/server/repositories";
import type { DomainServices } from "@/server/services";
import type { DeadLetterReplayService } from "./dead-letter-replay-service";
import type { EventReplayService } from "./event-replay-service";
import type { WorkerHandlerRegistry } from "./worker-handler-registry";
import type { WorkerRunnerService } from "./worker-runner-service";
import { createDeadLetterReplayService } from "./dead-letter-replay-service";
import { createEventReplayService } from "./event-replay-service";
import { createWorkerRunnerService } from "./worker-runner-service";

export interface RuntimeOperatorService {
  getDiagnostics(input: {
    organizationId: string;
    limit?: number;
  }): Promise<
    ServiceResult<{
      runtime: Awaited<ReturnType<DomainServices["runtime"]["diagnostics"]["getSummary"]>> extends ServiceResult<infer TValue>
        ? TValue
        : never;
      subscribers: Awaited<ReturnType<DomainServices["runtime"]["subscriberDiagnostics"]["getSummary"]>> extends ServiceResult<infer TValue>
        ? TValue
        : never;
      execution: RuntimeOperatorDiagnostics;
    }>
  >;
  processJobs(input: {
    organizationId: string;
    services: DomainServices;
    workerId: string;
    now?: string;
    maxJobs?: number;
    leaseDurationMs?: number;
    heartbeatIntervalMs?: number | null;
    jobTypes?: readonly string[];
    dryRun?: boolean;
  }): Promise<ServiceResult<WorkerRunnerBatchResult>>;
  processEvents(input: {
    organizationId: string;
    eventId?: string | null;
    batchSize?: number;
    force?: boolean;
    now?: string;
  }): Promise<ServiceResult<readonly EventProcessingResult[]>>;
  replayDeadLetter(input: {
    organizationId: string;
    deadLetterId: string;
    actor: ServiceActor;
    force?: boolean;
    now?: string;
  }): Promise<ServiceResult<WorkerJob>>;
}

export function createRuntimeOperatorService(
  dependencies: {
    repositories: Pick<FirestoreRepositories, "domainEvents" | "runtimeDeadLetters" | "runtimeJobs">;
    services: DomainServices;
    handlerRegistry?: WorkerHandlerRegistry<DomainServices>;
    runner?: WorkerRunnerService<DomainServices>;
    eventReplay?: EventReplayService;
    deadLetterReplay?: DeadLetterReplayService;
  },
): RuntimeOperatorService {
  const registry = dependencies.handlerRegistry;
  const runner =
    dependencies.runner ??
    createWorkerRunnerService(dependencies.services.runtime, registry ?? {
      get: () => null,
      list: () => [],
    });
  const eventReplay =
    dependencies.eventReplay ??
    createEventReplayService(dependencies.repositories, dependencies.services.runtime.subscribers);
  const deadLetterReplay =
    dependencies.deadLetterReplay ??
    createDeadLetterReplayService(dependencies.repositories, dependencies.services.runtime.jobs);

  return {
    async getDiagnostics(input) {
      const [runtime, subscribers, execution] = await Promise.all([
        dependencies.services.runtime.diagnostics.getSummary(input),
        dependencies.services.runtime.subscriberDiagnostics.getSummary(input),
        runner.getDiagnostics(input),
      ]);
      if (!runtime.ok) {
        return runtime;
      }
      if (!subscribers.ok) {
        return subscribers;
      }
      if (!execution.ok) {
        return execution;
      }

      return serviceOk({
        runtime: runtime.value,
        subscribers: subscribers.value,
        execution: execution.value,
      });
    },
    processJobs(input) {
      return runner.processPending(input);
    },
    processEvents(input) {
      return eventReplay.replay(input);
    },
    replayDeadLetter(input) {
      return deadLetterReplay.replay(input);
    },
  };
}
