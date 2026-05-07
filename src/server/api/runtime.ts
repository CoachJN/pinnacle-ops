import "server-only";

import { createEscalationProgressHandler } from "@/modules/escalation";
import { createDeliveryPlanHandler } from "@/modules/delivery";
import { createTransportExecuteHandler } from "@/modules/transport";
import { createProviderReceiptHandler } from "@/modules/provider-runtime";
import {
  createRuntimeOperatorService,
} from "@/modules/runtime/server/runtime-operator-service";
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
    context.services,
  ),
) {
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
    }),
  };
}

export function createProductionWorkerHandlerRegistry(
  services: DomainServices,
): WorkerHandlerRegistry<DomainServices> {
  return createWorkerHandlerRegistry<DomainServices>([
    createSlaTimerEvaluateHandler(services.sla.evaluator),
    createDeliveryPlanHandler(),
    createEscalationProgressHandler(),
    createTransportExecuteHandler(),
    createProviderReceiptHandler(),
  ]);
}
