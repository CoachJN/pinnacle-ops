import "server-only";

import type { ServiceResult } from "@/server/services/types";
import type { EntityId } from "@/types/entity";

import {
  buildWorkOrderDetailAggregate,
  createWorkOrderServiceDependencies,
  requireWorkOrder,
  type WorkOrderDetailDto,
  type WorkOrderServiceDependencies,
} from "./shared";

export interface GetWorkOrderDetailServiceInput {
  workOrderId: EntityId;
}

export interface GetWorkOrderDetailService {
  getWorkOrderDetail(
    input: GetWorkOrderDetailServiceInput,
  ): Promise<ServiceResult<WorkOrderDetailDto>>;
}

export function createGetWorkOrderDetailService(
  dependencies: Partial<WorkOrderServiceDependencies> = {},
): GetWorkOrderDetailService {
  return new DefaultGetWorkOrderDetailService(
    createWorkOrderServiceDependencies(dependencies),
  );
}

class DefaultGetWorkOrderDetailService implements GetWorkOrderDetailService {
  constructor(private readonly dependencies: WorkOrderServiceDependencies) {}

  async getWorkOrderDetail(
    input: GetWorkOrderDetailServiceInput,
  ): Promise<ServiceResult<WorkOrderDetailDto>> {
    const workOrder = await requireWorkOrder(this.dependencies.workOrders, input.workOrderId);
    if (!workOrder.ok) {
      return workOrder;
    }

    return {
      ok: true,
      value: await buildWorkOrderDetailAggregate(
        this.dependencies,
        workOrder.value,
      ),
    };
  }
}
