import "server-only";

import type { ClientQuote, WorkOrder } from "@/server/repositories";
import type { WorkOrderDetailDto } from "@/server/services/work-order-service";
import type {
  ClientPortalWorkOrderDetail,
  ClientPortalWorkOrderSummary,
} from "@/types/work-order";

export function toClientPortalWorkOrderSummary(
  workOrder: WorkOrder,
  currentQuote: ClientQuote | null,
): ClientPortalWorkOrderSummary {
  return {
    id: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    title: workOrder.title,
    status: workOrder.status,
    priority: workOrder.priority,
    locationId: workOrder.locationId,
    locationName: workOrder.locationSnapshot.name,
    category: workOrder.category,
    requestedServiceDate: workOrder.requestedServiceDate,
    createdAt: workOrder.createdAt,
    updatedAt: workOrder.updatedAt,
    currentQuoteStatus: currentQuote?.status ?? null,
    currentQuoteId: currentQuote?.id ?? null,
  };
}

export function toClientPortalWorkOrderDetail(
  detail: WorkOrderDetailDto,
  workOrder: WorkOrder,
  currentQuote: ClientQuote | null,
): ClientPortalWorkOrderDetail {
  return {
    id: workOrder.id,
    clientOrganizationId: workOrder.clientOrganizationId,
    clientOrganizationName: workOrder.clientSnapshot.name,
    workOrderNumber: workOrder.workOrderNumber,
    title: workOrder.title,
    description: workOrder.description,
    status: workOrder.status,
    priority: workOrder.priority,
    locationId: workOrder.locationId,
    locationName: workOrder.locationSnapshot.name,
    locationCode: null,
    locationAddress: workOrder.locationSnapshot.addressText,
    category: workOrder.category,
    requestedByName: detail.requestedByName,
    requestedByEmail: detail.requestedByEmail,
    requestedByPhone: detail.requestedByPhone,
    requestedServiceDate: workOrder.requestedServiceDate,
    dueDate: detail.dueDate,
    createdAt: workOrder.createdAt,
    updatedAt: workOrder.updatedAt,
    closedAt: workOrder.closedAt,
    currentQuoteStatus: currentQuote?.status ?? null,
    currentQuoteId: currentQuote?.id ?? null,
    activeQuote: currentQuote
      ? {
          id: currentQuote.id,
          status: currentQuote.status,
          totalAmount: currentQuote.totalAmount,
          sentAt: currentQuote.sentAt,
          respondedAt: currentQuote.respondedAt,
        }
      : null,
  };
}
