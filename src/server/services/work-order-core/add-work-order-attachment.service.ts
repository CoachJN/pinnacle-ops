import "server-only";

import type { ServiceResult } from "@/server/services/types";
import type { WorkOrderAttachment } from "@/modules/work-orders";
import { notFoundError } from "@/server/services/errors";
import { serviceFail, serviceOk } from "@/server/services/types";
import type { EntityId } from "@/types/entity";

import {
  assertWorkOrderAllowsCollaboration,
  createWorkOrderServiceDependencies,
  parseWorkOrderAttachmentPayload,
  requireWorkOrder,
  validateWorkOrderAttachmentStoragePath,
  type WorkOrderServiceDependencies,
} from "./shared.ts";

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
  private readonly dependencies: WorkOrderServiceDependencies;

  constructor(dependencies: WorkOrderServiceDependencies) {
    this.dependencies = dependencies;
  }

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

    const collaborationResult = assertWorkOrderAllowsCollaboration(
      workOrder.value.status,
      "attachments",
    );
    if (!collaborationResult.ok) {
      return collaborationResult;
    }

    const storagePathResult = validateWorkOrderAttachmentStoragePath(
      workOrder.value.id,
      parsedPayload.value.storagePath,
    );
    if (!storagePathResult.ok) {
      return storagePathResult;
    }

    const attachment = await this.dependencies.attachments.createAttachment({
      workOrderId: workOrder.value.id,
      data: parsedPayload.value,
      now: input.now ?? new Date().toISOString(),
    });

    if (!attachment) {
      return serviceFail(notFoundError("Work order could not be found."));
    }

    return serviceOk(attachment);
  }
}
