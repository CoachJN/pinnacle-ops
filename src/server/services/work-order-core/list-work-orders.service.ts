import "server-only";

import type { ServiceResult } from "@/server/services/types";

import {
  createWorkOrderServiceDependencies,
  parseWorkOrderListQuery,
  toWorkOrderListItemDto,
  type WorkOrderListResultDto,
  type WorkOrderServiceDependencies,
} from "./shared.ts";

export interface ListWorkOrdersServiceInput {
  query?: unknown;
}

export interface ListWorkOrdersService {
  listWorkOrders(
    input: ListWorkOrdersServiceInput,
  ): Promise<ServiceResult<WorkOrderListResultDto>>;
}

export function createListWorkOrdersService(
  dependencies: Partial<WorkOrderServiceDependencies> = {},
): ListWorkOrdersService {
  return new DefaultListWorkOrdersService(
    createWorkOrderServiceDependencies(dependencies),
  );
}

class DefaultListWorkOrdersService implements ListWorkOrdersService {
  private readonly dependencies: WorkOrderServiceDependencies;

  constructor(dependencies: WorkOrderServiceDependencies) {
    this.dependencies = dependencies;
  }

  async listWorkOrders(
    input: ListWorkOrdersServiceInput,
  ): Promise<ServiceResult<WorkOrderListResultDto>> {
    const parsedQuery = parseWorkOrderListQuery(input.query ?? {});
    if (!parsedQuery.ok) {
      return parsedQuery;
    }

    const items = await this.dependencies.workOrders.list({
      status: parsedQuery.value.status,
      priority: parsedQuery.value.priority,
      category: parsedQuery.value.category,
      source: parsedQuery.value.source,
      clientOrganizationId: parsedQuery.value.clientOrganizationId,
      locationId: parsedQuery.value.locationId,
      assignedCoordinatorUserId: parsedQuery.value.assignedCoordinatorUserId,
      assignedManagerUserId: parsedQuery.value.assignedManagerUserId,
      requestedByEmail: parsedQuery.value.requestedByEmail,
      dueDateFrom: parsedQuery.value.dueDateFrom,
      dueDateTo: parsedQuery.value.dueDateTo,
      search: parsedQuery.value.search,
      isArchived: parsedQuery.value.isArchived,
      limit: parsedQuery.value.limit,
    });

    return {
      ok: true,
      value: {
        items: items.map(toWorkOrderListItemDto),
      },
    };
  }
}
