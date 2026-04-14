import type { ActivityEntry, PhaseOneWorkOrder } from "../../types/work-order.ts";
import type { Quote } from "../../types/quote.ts";
import type { EntityId } from "../../types/entity.ts";
import { getCurrentQuoteForWorkOrder } from "../quotes/repository.ts";
import {
  getActivityForWorkOrder,
  getWorkOrderById,
  listWorkOrders,
} from "../work-orders/repository.ts";

export type ContractorWorkOrderFilter =
  | "all"
  | "quote_requested"
  | "approved_to_proceed"
  | "in_progress"
  | "completed";

export interface ContractorWorkOrderListItem {
  id: EntityId;
  workOrderNumber: string;
  title: string;
  clientName: string;
  locationName: string;
  serviceAddress: string;
  status: PhaseOneWorkOrder["status"];
  requestedServiceDate: string | null;
  quoteActionNeeded: boolean;
  updatedAt: string;
}

export interface ContractorDashboardData {
  summaries: {
    assigned: number;
    quoteRequested: number;
    approvedToProceed: number;
    inProgress: number;
  };
  needsQuote: ContractorWorkOrderListItem[];
  readyToPerform: ContractorWorkOrderListItem[];
  activeWork: ContractorWorkOrderListItem[];
}

export interface ContractorWorkOrderDetailView extends ContractorWorkOrderListItem {
  priority: PhaseOneWorkOrder["priority"];
  locationContactName: string;
  locationContactPhone: string;
  description: string;
  category: string | null;
  assignedContractorName: string | null;
  quote: ContractorQuoteSummary | null;
  completionNotes: string | null;
  visibleActivity: ContractorVisibleActivity[];
}

export interface ContractorQuoteSummary {
  id: EntityId;
  status: Quote["status"];
  versionNumber: number;
  laborAmount: number;
  materialAmount: number;
  otherAmount: number;
  totalAmount: number;
  scopeSummary: string;
  contractorNotes: string | null;
}

export interface ContractorVisibleActivity {
  id: EntityId;
  type: ActivityEntry["type"];
  message: string;
  createdAt: string;
  actorName: string;
}

export async function getContractorDashboardData(
  contractorId: EntityId,
): Promise<ContractorDashboardData> {
  const items = await getContractorWorkOrderList(contractorId, "all");
  const needsQuote = items.filter((item) => item.status === "quote_requested");
  const readyToPerform = items.filter(
    (item) =>
      item.status === "approved_to_proceed" || item.status === "dispatched",
  );
  const activeWork = items.filter((item) => item.status === "in_progress");

  return {
    summaries: {
      assigned: items.length,
      quoteRequested: needsQuote.length,
      approvedToProceed: readyToPerform.length,
      inProgress: activeWork.length,
    },
    needsQuote,
    readyToPerform,
    activeWork,
  };
}

export async function getContractorWorkOrderList(
  contractorId: EntityId,
  filter: ContractorWorkOrderFilter = "all",
): Promise<ContractorWorkOrderListItem[]> {
  const workOrders = await listWorkOrders({ sort: "updatedAt" });
  return workOrders
    .filter((workOrder) => workOrder.assignedContractorId === contractorId)
    .filter((workOrder) => matchesContractorFilter(workOrder, filter))
    .map(toContractorWorkOrderListItem);
}

export async function getContractorWorkOrderDetailView(
  contractorId: EntityId,
  workOrderId: EntityId,
): Promise<ContractorWorkOrderDetailView | null> {
  const workOrder = await getWorkOrderById(workOrderId);
  if (!workOrder || workOrder.assignedContractorId !== contractorId) {
    return null;
  }

  const [quote, activity] = await Promise.all([
    getCurrentQuoteForWorkOrder(workOrder.id),
    getActivityForWorkOrder(workOrder.id),
  ]);

  return {
    ...toContractorWorkOrderListItem(workOrder),
    priority: workOrder.priority,
    locationContactName: workOrder.contactName,
    locationContactPhone: workOrder.contactPhone,
    description: workOrder.description,
    category: workOrder.category,
    assignedContractorName: workOrder.assignedContractorName,
    quote:
      quote && quote.assignedContractorId === contractorId
        ? toContractorQuoteSummary(quote)
        : null,
    completionNotes: workOrder.completionNotes,
    visibleActivity: getContractorVisibleActivity(activity),
  };
}

export function getContractorVisibleActivity(
  activity: ActivityEntry[],
): ContractorVisibleActivity[] {
  const visibleTypes: ActivityEntry["type"][] = [
    "contractor_assigned",
    "quote_requested",
    "quote_submitted",
    "quote_client_approved",
    "status_changed",
    "contractor_status_updated",
    "contractor_completion_notes_added",
  ];

  return activity
    .filter(
      (entry) =>
        visibleTypes.includes(entry.type) && entry.actorRole !== "system",
    )
    .map((entry) => ({
      id: entry.id,
      type: entry.type,
      message: entry.message,
      createdAt: entry.createdAt,
      actorName: entry.actorName,
    }));
}

function toContractorWorkOrderListItem(
  workOrder: PhaseOneWorkOrder,
): ContractorWorkOrderListItem {
  return {
    id: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    title: workOrder.title,
    clientName: workOrder.clientName,
    locationName: workOrder.locationName,
    serviceAddress: workOrder.locationAddress,
    status: workOrder.status,
    requestedServiceDate: workOrder.requestedServiceDate,
    quoteActionNeeded:
      workOrder.requiresQuote && workOrder.status === "quote_requested",
    updatedAt: workOrder.updatedAt,
  };
}

function toContractorQuoteSummary(quote: Quote): ContractorQuoteSummary {
  return {
    id: quote.id,
    status: quote.status,
    versionNumber: quote.versionNumber,
    laborAmount: quote.laborAmount,
    materialAmount: quote.materialAmount,
    otherAmount: quote.otherAmount,
    totalAmount: quote.totalAmount,
    scopeSummary: quote.scopeSummary,
    contractorNotes: quote.contractorNotes,
  };
}

function matchesContractorFilter(
  workOrder: PhaseOneWorkOrder,
  filter: ContractorWorkOrderFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "approved_to_proceed") {
    return (
      workOrder.status === "approved_to_proceed" ||
      workOrder.status === "dispatched"
    );
  }

  if (filter === "completed") {
    return workOrder.status === "completed" || workOrder.status === "closed";
  }

  return workOrder.status === filter;
}
