import "server-only";

import {
  serviceOk,
  serviceFail,
  type ServiceResult,
} from "@/server/services/types";
import { notFoundError } from "@/server/services/errors";
import type { EntityId } from "@/types/entity";

import {
  buildWorkOrderDetailAggregate,
  createWorkOrderServiceDependencies,
  enforceWorkOrderStatusTransition,
  parseWorkOrderStatusPayload,
  requireWorkOrder,
  resolveClosedAt,
  type WorkOrderDetailDto,
  type WorkOrderServiceDependencies,
} from "./shared";

export interface UpdateWorkOrderStatusServiceInput {
  workOrderId: EntityId;
  payload: unknown;
  now?: string;
}

export interface UpdateWorkOrderStatusService {
  updateWorkOrderStatus(
    input: UpdateWorkOrderStatusServiceInput,
  ): Promise<ServiceResult<WorkOrderDetailDto>>;
}

export function createUpdateWorkOrderStatusService(
  dependencies: Partial<WorkOrderServiceDependencies> = {},
): UpdateWorkOrderStatusService {
  return new DefaultUpdateWorkOrderStatusService(
    createWorkOrderServiceDependencies(dependencies),
  );
}

class DefaultUpdateWorkOrderStatusService
  implements UpdateWorkOrderStatusService
{
  constructor(private readonly dependencies: WorkOrderServiceDependencies) {}

  async updateWorkOrderStatus(
    input: UpdateWorkOrderStatusServiceInput,
  ): Promise<ServiceResult<WorkOrderDetailDto>> {
    const parsedPayload = parseWorkOrderStatusPayload(input.payload);
    if (!parsedPayload.ok) {
      return parsedPayload;
    }

    const currentWorkOrder = await requireWorkOrder(
      this.dependencies.workOrders,
      input.workOrderId,
    );
    if (!currentWorkOrder.ok) {
      return currentWorkOrder;
    }

    const transitionResult = enforceWorkOrderStatusTransition(
      currentWorkOrder.value.status,
      parsedPayload.value.status,
    );
    if (!transitionResult.ok) {
      return transitionResult;
    }

    const now = input.now ?? new Date().toISOString();
    const updated = await this.dependencies.workOrders.updateStatus({
      workOrderId: input.workOrderId,
      status: parsedPayload.value.status,
      closedAt: resolveClosedAt(
        currentWorkOrder.value.status,
        parsedPayload.value.status,
        now,
      ),
      now,
    });

    if (!updated) {
      return serviceFail(notFoundError("Work order could not be found."));
    }

    return serviceOk(await buildWorkOrderDetailAggregate(this.dependencies, updated));
  }
}
