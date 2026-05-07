import "server-only";

import type { CommunicationTimelineEntry } from "@/modules/communications";
import type { ClientQuote, WorkOrder } from "@/server/repositories";
import type {
  ClientPortalWorkOrderDetail,
  ClientPortalWorkOrderSummary,
} from "@/types/work-order";

interface ClientPortalWorkOrderDetailSource {
  dueDate?: string | null;
  communications?: CommunicationTimelineEntry[];
}

export function toClientPortalWorkOrderSummary(
  workOrder: WorkOrder,
  currentQuote: ClientQuote | null,
): ClientPortalWorkOrderSummary {
  const shortDescription =
    "shortDescription" in workOrder && typeof workOrder.shortDescription === "string"
      ? workOrder.shortDescription
      : workOrder.title;

  return {
    id: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    shortDescription,
    lifecycleStatus: workOrder.lifecycleStatus,
    priority: workOrder.priority,
    clientOrganizationId: workOrder.clientOrganizationId,
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
  detail: ClientPortalWorkOrderDetailSource,
  workOrder: WorkOrder,
  currentQuote: ClientQuote | null,
): ClientPortalWorkOrderDetail {
  const shortDescription =
    "shortDescription" in workOrder && typeof workOrder.shortDescription === "string"
      ? workOrder.shortDescription
      : workOrder.title;

  return {
    id: workOrder.id,
    clientOrganizationId: workOrder.clientOrganizationId,
    clientOrganizationName: workOrder.clientSnapshot.name,
    workOrderNumber: workOrder.workOrderNumber,
    shortDescription,
    description: workOrder.description,
    lifecycleStatus: workOrder.lifecycleStatus,
    priority: workOrder.priority,
    locationId: workOrder.locationId,
    locationName: workOrder.locationSnapshot.name,
    locationCode: null,
    locationAddress: workOrder.locationSnapshot.addressText,
    category: workOrder.category,
    coordinatorUserId:
      "coordinatorUserId" in workOrder &&
      typeof workOrder.coordinatorUserId === "string"
        ? workOrder.coordinatorUserId
        : null,
    managerUserId:
      "managerUserId" in workOrder &&
      typeof workOrder.managerUserId === "string"
        ? workOrder.managerUserId
        : null,
    assignedContractorId:
      "assignedContractorId" in workOrder &&
      typeof workOrder.assignedContractorId === "string"
        ? workOrder.assignedContractorId
        : null,
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
    communications: detail.communications ?? [],
  };
}
