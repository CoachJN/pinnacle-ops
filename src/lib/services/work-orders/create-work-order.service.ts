import "server-only";

import {
  serviceOk,
  type ServiceResult,
} from "@/server/services/types";
import type { EntityId } from "@/types/entity";

import {
  buildWorkOrderDetailAggregate,
  createWorkOrderServiceDependencies,
  generateWorkOrderNumber,
  normalizeWorkOrderSearchText,
  parseWorkOrderCreatePayload,
  resolveInitialWorkOrderStatus,
  type WorkOrderDetailDto,
  type WorkOrderServiceDependencies,
  type WorkOrderStatusControls,
} from "./shared";
import { validateWorkOrderRelationships } from "./shared";

export interface CreateWorkOrderServiceInput {
  payload: unknown;
  controls?: WorkOrderStatusControls;
  now?: string;
  workOrderId?: EntityId;
}

export interface CreateWorkOrderService {
  createWorkOrder(
    input: CreateWorkOrderServiceInput,
  ): Promise<ServiceResult<WorkOrderDetailDto>>;
}

export function createCreateWorkOrderService(
  dependencies: Partial<WorkOrderServiceDependencies> = {},
): CreateWorkOrderService {
  return new DefaultCreateWorkOrderService(
    createWorkOrderServiceDependencies(dependencies),
  );
}

class DefaultCreateWorkOrderService implements CreateWorkOrderService {
  constructor(private readonly dependencies: WorkOrderServiceDependencies) {}

  async createWorkOrder(
    input: CreateWorkOrderServiceInput,
  ): Promise<ServiceResult<WorkOrderDetailDto>> {
    const parsedPayload = parseWorkOrderCreatePayload(input.payload);
    if (!parsedPayload.ok) {
      return parsedPayload;
    }

    const relationshipResult = await validateWorkOrderRelationships(
      this.dependencies,
      {
        clientOrganizationId: parsedPayload.value.clientOrganizationId,
        locationId: parsedPayload.value.locationId,
      },
    );
    if (!relationshipResult.ok) {
      return relationshipResult;
    }

    const resolvedStatus = resolveInitialWorkOrderStatus(
      parsedPayload.value,
      input.controls,
    );
    if (!resolvedStatus.ok) {
      return resolvedStatus;
    }

    const workOrderId = input.workOrderId ?? crypto.randomUUID();
    const workOrderNumber = generateWorkOrderNumber(workOrderId);
    const searchText = normalizeWorkOrderSearchText({
      workOrderNumber,
      title: parsedPayload.value.title,
      description: parsedPayload.value.description,
      requestedByName: parsedPayload.value.requestedByName,
      requestedByEmail: parsedPayload.value.requestedByEmail,
      requestedByPhone: parsedPayload.value.requestedByPhone,
      clientOrganizationId: relationshipResult.value.clientOrganization.id,
      locationId: relationshipResult.value.location.id,
    });
    const now = input.now ?? new Date().toISOString();

    const workOrder = await this.dependencies.workOrders.create({
      id: workOrderId,
      data: parsedPayload.value,
      now,
      status: resolvedStatus.value,
      workOrderNumber,
      searchText,
      closedAt: resolvedStatus.value === "CLOSED" ? now : null,
    });

    return serviceOk(
      await buildWorkOrderDetailAggregate(this.dependencies, workOrder),
    );
  }
}
