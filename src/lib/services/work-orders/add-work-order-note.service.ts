import "server-only";

import type { ServiceResult } from "@/server/services/types";
import type { WorkOrderNote } from "@/modules/work-orders";
import { notFoundError } from "@/server/services/errors";
import { serviceFail, serviceOk } from "@/server/services/types";
import type { EntityId } from "@/types/entity";

import {
  assertWorkOrderAllowsCollaboration,
  createWorkOrderServiceDependencies,
  parseWorkOrderNotePayload,
  requireWorkOrder,
  type WorkOrderServiceDependencies,
} from "./shared.ts";

export interface AddWorkOrderNoteServiceInput {
  workOrderId: EntityId;
  payload: unknown;
  now?: string;
}

export interface AddWorkOrderNoteService {
  addWorkOrderNote(
    input: AddWorkOrderNoteServiceInput,
  ): Promise<ServiceResult<WorkOrderNote>>;
}

export function createAddWorkOrderNoteService(
  dependencies: Partial<WorkOrderServiceDependencies> = {},
): AddWorkOrderNoteService {
  return new DefaultAddWorkOrderNoteService(
    createWorkOrderServiceDependencies(dependencies),
  );
}

class DefaultAddWorkOrderNoteService implements AddWorkOrderNoteService {
  private readonly dependencies: WorkOrderServiceDependencies;

  constructor(dependencies: WorkOrderServiceDependencies) {
    this.dependencies = dependencies;
  }

  async addWorkOrderNote(
    input: AddWorkOrderNoteServiceInput,
  ): Promise<ServiceResult<WorkOrderNote>> {
    const parsedPayload = parseWorkOrderNotePayload(input.payload);
    if (!parsedPayload.ok) {
      return parsedPayload;
    }

    const workOrder = await requireWorkOrder(this.dependencies.workOrders, input.workOrderId);
    if (!workOrder.ok) {
      return workOrder;
    }

    const collaborationResult = assertWorkOrderAllowsCollaboration(
      workOrder.value.status,
      "notes",
    );
    if (!collaborationResult.ok) {
      return collaborationResult;
    }

    const note = await this.dependencies.notes.createNote({
      workOrderId: workOrder.value.id,
      data: parsedPayload.value,
      now: input.now ?? new Date().toISOString(),
    });

    if (!note) {
      return serviceFail(notFoundError("Work order could not be found."));
    }

    return serviceOk(note);
  }
}
