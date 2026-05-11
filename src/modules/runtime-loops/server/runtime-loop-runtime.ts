import "server-only";

import {
  createFirestoreRuntimeAllocatorRepositories,
  createAllocatorLeaseService,
  createRuntimeAllocatorService,
} from "@/modules/runtime-allocator";
import {
  createAllocatorExecutionService,
  createFirestoreRuntimeClaimRepositories,
  createRuntimeClaimBalancerService,
  createRuntimeClaimService,
  createRuntimeWorkerHeartbeatService,
  createRuntimeWorkerScalingService,
} from "@/modules/runtime-claim";
import { createRuntimeCapacityServices } from "@/modules/runtime-capacity";
import { createFirestoreSchedulerRepositories } from "@/modules/scheduler/server/scheduler-task-repository";
import { createRuntimeSchedulerService } from "@/modules/scheduler/server/runtime-scheduler-service";
import { createWorkerRunnerService } from "@/modules/runtime/server/worker-runner-service";
import {
  createProductionWorkerHandlerRegistry,
} from "@/server/api/runtime";
import type { WorkOrderApiContext } from "@/server/api/work-orders";
import type { ProviderReceiptRepository } from "@/modules/provider-runtime/server/provider-receipt-repository";
import { createAllocatorLoopRunner } from "./allocator-loop-runner";
import { createProviderReconciliationLoopRunner } from "./provider-reconciliation-loop-runner";
import { createRuntimeDrainService } from "./runtime-drain-service";
import { createRuntimeLoopCoordinator } from "./runtime-loop-coordinator";
import { createRuntimeLoopDiagnosticsService } from "./runtime-loop-diagnostics-service";
import { createRuntimeLoopHealthService } from "./runtime-loop-health-service";
import { createRuntimeLoopHeartbeatService } from "./runtime-loop-heartbeat-service";
import { createFirestoreRuntimeLoopRepositories } from "./runtime-loop-repository";
import { createRuntimeLoopService } from "./runtime-loop-service";
import { createSchedulerLoopRunner } from "./scheduler-loop-runner";
import { createWorkerDaemonRunner } from "./worker-daemon-runner";

export function createRuntimeLoopRuntime(context: WorkOrderApiContext) {
  const loopRepositories = createFirestoreRuntimeLoopRepositories();
  const loopService = createRuntimeLoopService(loopRepositories.loops);
  const heartbeat = createRuntimeLoopHeartbeatService(
    loopRepositories.loops,
    loopService,
    loopRepositories.events,
  );
  const drain = createRuntimeDrainService(
    loopRepositories.state,
    loopRepositories.events,
    loopRepositories.loops,
  );
  const coordinator = createRuntimeLoopCoordinator(
    loopService,
    heartbeat,
    drain,
    loopRepositories.results,
    loopRepositories.loops,
  );

  const runtimeCapacity = createRuntimeCapacityServices({
    repositories: {
      runtimeJobs: context.repositories.runtimeJobs,
      runtimeDeadLetters: context.repositories.runtimeDeadLetters,
      deliveryAttempts: context.repositories.deliveryAttempts,
      escalationOrchestrations: context.repositories.escalationOrchestrations,
    },
    providerRuntimeStorage: context.services.providerRuntime.storage,
  });

  const handlerRegistry = createProductionWorkerHandlerRegistry(context);
  const workerRunner = createWorkerRunnerService(
    context.services.runtime,
    handlerRegistry,
    runtimeCapacity.guardrails,
  );

  const schedulerRepositories = createFirestoreSchedulerRepositories();
  const scheduler = createRuntimeSchedulerService(
    schedulerRepositories,
    context.services.runtime,
    runtimeCapacity.guardrails,
  );

  const allocatorRepositories = createFirestoreRuntimeAllocatorRepositories();
  const claimRepositories = createFirestoreRuntimeClaimRepositories();
  const allocator = createRuntimeAllocatorService(allocatorRepositories.global);
  const allocatorLeaseService = createAllocatorLeaseService(
    allocatorRepositories.leases,
  );
  const claimBalancer = createRuntimeClaimBalancerService();
  const workerHeartbeat = createRuntimeWorkerHeartbeatService(
    claimRepositories.workers,
    claimRepositories.recovery,
  );
  const workerScaling = createRuntimeWorkerScalingService();
  const claimService = createRuntimeClaimService(
    { ...claimRepositories.source, ...claimRepositories.windows },
    context.services.runtime.lease,
    runtimeCapacity.guardrails,
  );
  const allocatorExecution = createAllocatorExecutionService(
    allocator,
    allocatorLeaseService,
    claimBalancer,
    claimService,
    workerHeartbeat,
    workerScaling,
    claimRepositories.windows,
  );

  const health = createRuntimeLoopHealthService(
    loopService,
    heartbeat,
    drain,
    context.services.runtime.diagnostics,
    context.services.providerRuntime.health,
    loopRepositories.results,
  );
  const diagnostics = createRuntimeLoopDiagnosticsService(
    health,
    loopService,
    loopRepositories.results,
    loopRepositories.events,
    context.services.runtime.diagnostics,
    context.services.providerRuntime.health,
    drain,
  );

  return {
    repositories: loopRepositories,
    services: {
      loopService,
      heartbeat,
      drain,
      coordinator,
      health,
      diagnostics,
    },
    runners: {
      allocator: createAllocatorLoopRunner(coordinator, allocatorExecution),
      scheduler: createSchedulerLoopRunner(coordinator, scheduler),
      reconciliation: createProviderReconciliationLoopRunner(
        coordinator,
        context.services.runtime.jobs,
        context.services.providerRuntime.storage.receipts as ProviderReceiptRepository,
      ),
      workerDaemon: createWorkerDaemonRunner(coordinator, workerRunner),
    },
  };
}
