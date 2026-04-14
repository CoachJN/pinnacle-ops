import "server-only";

import type { ServiceResult } from "@/server/services/types";
import type { WorkOrderAttachment } from "@/modules/work-orders";
import { conflictError, notFoundError } from "@/server/services/errors";
import { serviceFail } from "@/server/services/types";
import type { EntityId } from "@/types/entity";

import {
  createWorkOrderServiceDependencies,
  parseWorkOrderAttachmentPayload,
  requireWorkOrder,
  type WorkOrderServiceDependencies,
} from "./shared";

export interface AddWorkOrderAttachmentServiceInput {
  workOrderId: EntityId;
  payload: unknown;
  now?: string;
}

export interface AddWorkOrderAttachmentService {
  addWorkOrderAttachment(
    input: AddWorkOrderAttachmentServiceInput,
  ): Promise<ServiceResult<WorkOrderAttachment>>;
}

export function createAddWorkOrderAttachmentService(
  dependencies: Partial<WorkOrderServiceDependencies> = {},
): AddWorkOrderAttachmentService {
  return new DefaultAddWorkOrderAttachmentService(
    createWorkOrderServiceDependencies(dependencies),
  );
}

class DefaultAddWorkOrderAttachmentService
  implements AddWorkOrderAttachmentService
{
  constructor(private readonly dependencies: WorkOrderServiceDependencies) {}

  async addWorkOrderAttachment(
    input: AddWorkOrderAttachmentServiceInput,
  ): Promise<ServiceResult<WorkOrderAttachment>> {
    const parsedPayload = parseWorkOrderAttachmentPayload(input.payload);
    if (!parsedPayload.ok) {
      return parsedPayload;
    }

    const workOrder = await requireWorkOrder(this.dependencies.workOrders, input.workOrderId);
    if (!workOrder.ok) {
      return workOrder;
    }

    if (workOrder.value.status === "CLOSED") {
      return serviceFail(
        conflictError("Cannot add attachments to a closed work order."),
      );
    }

    const attachment = await this.dependencies.attachments.createAttachment({
      workOrderId: workOrder.value.id,
      data: parsedPayload.value,
      now: input.now ?? new Date().toISOString(),
    });

    if (!attachment) {
      return serviceFail(notFoundError("Work order could not be found."));
    }

    return { ok: true, value: attachment };
  }
}
