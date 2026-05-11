import "server-only";

import { createEscalationProgressHandler } from "@/modules/escalation";
import { createDeliveryPlanHandler } from "@/modules/delivery";
import { createTransportExecuteHandler } from "@/modules/transport";
import { createProviderReceiptHandler } from "@/modules/provider-runtime";
import {
  createProjectionRefreshHandler,
  createProviderReconciliationSweepHandler,
  createRuntimeHealthRefreshHandler,
  createSlaScanHandler,
} from "@/modules/scheduler";
import {
  createRuntimeOperatorService,
} from "@/modules/runtime/server/runtime-operator-service";
import { createWorkerRunnerService } from "@/modules/runtime/server/worker-runner-service";
import { createRuntimeCapacityServices } from "@/modules/runtime-capacity";
import { createSlaTimerEvaluateHandler } from "@/modules/sla";
import {
  createWorkerHandlerRegistry,
  type WorkerHandlerRegistry,
} from "@/modules/runtime/server/worker-handler-registry";
import {
  authorizeOperationalRuntimeAccess,
} from "@/server/api/provider-runtime";
import {
  getWorkOrderApiContext,
  type ApiRequestContext,
  type WorkOrderApiContext,
} from "@/server/api/work-orders";
import type { DomainServices } from "@/server/services";

export async function getRuntimeApiContext(
  requestContext: ApiRequestContext | null = null,
): Promise<WorkOrderApiContext> {
  const context = await getWorkOrderApiContext(requestContext);
  authorizeOperationalRuntimeAccess(context);
  return context;
}

export function createRuntimeOperatorContext(
  context: WorkOrderApiContext,
  handlerRegistry: WorkerHandlerRegistry<DomainServices> = createProductionWorkerHandlerRegistry(
    context,
  ),
) {
  const runtimeCapacity = createRuntimeCapacityServices({
    repositories: {
      runtimeJobs: context.repositories.runtimeJobs,
      runtimeDeadLetters: context.repositories.runtimeDeadLetters,
      deliveryAttempts: context.repositories.deliveryAttempts,
      escalationOrchestrations: context.repositories.escalationOrchestrations,
    },
    providerRuntimeStorage: context.services.providerRuntime.storage,
  });
  return {
    ...context,
    operator: createRuntimeOperatorService({
      repositories: {
        domainEvents: context.repositories.domainEvents,
        runtimeDeadLetters: context.repositories.runtimeDeadLetters,
        runtimeJobs: context.repositories.runtimeJobs,
      },
      services: context.services,
      handlerRegistry,
      runner: createWorkerRunnerService(
        context.services.runtime,
        handlerRegistry,
        runtimeCapacity.guardrails,
      ),
    }),
  };
}

export function createProductionWorkerHandlerRegistry(
  context: Pick<WorkOrderApiContext, "repositories" | "services">,
): WorkerHandlerRegistry<DomainServices> {
  return createWorkerHandlerRegistry<DomainServices>([
    createSlaTimerEvaluateHandler(context.services.sla.evaluator),
    createDeliveryPlanHandler(),
    createEscalationProgressHandler(),
    createTransportExecuteHandler(),
    createProviderReceiptHandler(),
    createProjectionRefreshHandler(
      {
        domainEvents: context.repositories.domainEvents,
        runtimeJobs: context.repositories.runtimeJobs,
        runtimeDeadLetters: context.repositories.runtimeDeadLetters,
        runtimeEventProcessings: context.repositories.runtimeEventProcessings,
        deliveryPlans: context.repositories.deliveryPlans,
        deliveryAttempts: context.repositories.deliveryAttempts,
        escalationOrchestrations: context.repositories.escalationOrchestrations,
        slaTimers: context.repositories.slaTimers,
      },
      {
        runtime: context.services.runtime,
        providerRuntime: context.services.providerRuntime,
        delivery: context.services.delivery,
      },
    ),
    createRuntimeHealthRefreshHandler(
      {
        domainEvents: context.repositories.domainEvents,
        runtimeJobs: context.repositories.runtimeJobs,
        runtimeDeadLetters: context.repositories.runtimeDeadLetters,
        runtimeEventProcessings: context.repositories.runtimeEventProcessings,
        deliveryPlans: context.repositories.deliveryPlans,
        deliveryAttempts: context.repositories.deliveryAttempts,
        escalationOrchestrations: context.repositories.escalationOrchestrations,
        slaTimers: context.repositories.slaTimers,
      },
      {
        runtime: context.services.runtime,
        providerRuntime: context.services.providerRuntime,
        delivery: context.services.delivery,
      },
    ),
    createSlaScanHandler(
      {
        runtimeJobs: context.repositories.runtimeJobs,
        runtimeDeadLetters: context.repositories.runtimeDeadLetters,
        slaTimers: context.repositories.slaTimers,
        slaScanCursors: context.repositories.slaScanCursors,
      },
      {
        runtime: context.services.runtime,
        sla: context.services.sla,
      },
    ),
    createProviderReconciliationSweepHandler(),
  ]);
}
