import "server-only";

import type { Location, Quote, Assignment, WorkOrder } from "@/server/repositories";
import type { ActivityLog } from "@/server/repositories";
import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { AssignmentStatus, WorkOrderPriority, WorkOrderStatus } from "@/types/work-order";
import {
  toContractorPortalQuoteSummary,
  type ContractorPortalQuoteSummary,
} from "@/modules/quotes/contractor-portal";

export type ContractorWorkOrderFilter =
  | "all"
  | "quote_requested"
  | "approved_to_proceed"
  | "in_progress"
  | "completed";

export interface ContractorPortalActivityEntry {
  id: EntityId;
  message: string;
  createdAt: IsoDateTimeString;
  actorLabel: string;
}

export interface ContractorPortalAssignmentSummary {
  id: EntityId;
  status: AssignmentStatus;
  assignedAt: IsoDateTimeString;
  acceptedAt: IsoDateTimeString | null;
  declinedAt: IsoDateTimeString | null;
  completedAt: IsoDateTimeString | null;
  scheduledDate: IsoDateTimeString | null;
  timeWindowStart: IsoDateTimeString | null;
  timeWindowEnd: IsoDateTimeString | null;
}

export interface ContractorPortalActionAvailability {
  canAcceptAssignment: boolean;
  canDeclineAssignment: boolean;
  canCompleteAssignment: boolean;
  canSubmitQuote: boolean;
}

export interface ContractorPortalWorkOrderListItem {
  id: EntityId;
  workOrderNumber: string;
  title: string;
  clientName: string;
  locationName: string;
  serviceAddress: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  requestedServiceDate: IsoDateTimeString | null;
  updatedAt: IsoDateTimeString;
  assignment: ContractorPortalAssignmentSummary;
  quoteStatus: Quote["status"] | null;
  quoteActionNeeded: boolean;
}

export interface ContractorPortalWorkOrderDetail
  extends ContractorPortalWorkOrderListItem {
  description: string;
  category: string | null;
  locationContactName: string | null;
  locationContactPhone: string | null;
  locationContactEmail: string | null;
  accessNotes: string | null;
  quote: ContractorPortalQuoteSummary | null;
  visibleActivity: ContractorPortalActivityEntry[];
  actionAvailability: ContractorPortalActionAvailability;
}

export function matchesContractorPortalFilter(
  item: ContractorPortalWorkOrderListItem,
  filter: ContractorWorkOrderFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "approved_to_proceed") {
    return (
      item.status === "approved_to_proceed" ||
      item.status === "dispatched" ||
      item.status === "assigned" ||
      item.status === "scheduled"
    );
  }

  if (filter === "completed") {
    return item.status === "completed" || item.status === "closed";
  }

  return item.status === filter;
}

export function getContractorPortalActionAvailability(input: {
  workOrder: WorkOrder;
  assignment: Assignment;
  quote: Quote | null;
}): ContractorPortalActionAvailability {
  const canRespondToAssignment = input.assignment.status === "assigned";
  const hasEditableQuote =
    input.quote !== null &&
    (input.quote.status === "draft" ||
      input.quote.status === "client_rejected" ||
      input.quote.status === "superseded");

  return {
    canAcceptAssignment: canRespondToAssignment,
    canDeclineAssignment: canRespondToAssignment,
    canCompleteAssignment:
      input.assignment.status === "accepted" &&
      input.workOrder.status !== "completed" &&
      input.workOrder.status !== "closed" &&
      input.workOrder.status !== "cancelled",
    canSubmitQuote:
      input.workOrder.status === "quote_requested" &&
      (input.assignment.status === "assigned" ||
        input.assignment.status === "accepted") &&
      (input.quote === null || hasEditableQuote),
  };
}

export function isRelevantContractorPortalAssignment(
  assignment: Assignment,
): boolean {
  return assignment.assigneeType === "contractor" && assignment.status !== "cancelled";
}

export function toContractorPortalWorkOrderListItem(input: {
  workOrder: WorkOrder;
  assignment: Assignment;
  quote: Quote | null;
}): ContractorPortalWorkOrderListItem {
  const actionAvailability = getContractorPortalActionAvailability(input);

  return {
    id: input.workOrder.id,
    workOrderNumber: input.workOrder.workOrderNumber,
    title: input.workOrder.title,
    clientName: input.workOrder.clientSnapshot.name,
    locationName: input.workOrder.locationSnapshot.name,
    serviceAddress: input.workOrder.locationSnapshot.addressText ?? "Address unavailable",
    status: input.workOrder.status,
    priority: input.workOrder.priority,
    requestedServiceDate: input.workOrder.requestedServiceDate,
    updatedAt: input.workOrder.updatedAt,
    assignment: toContractorPortalAssignmentSummary(input.assignment),
    quoteStatus: input.quote?.status ?? null,
    quoteActionNeeded: actionAvailability.canSubmitQuote,
  };
}

export function toContractorPortalWorkOrderDetail(input: {
  workOrder: WorkOrder;
  assignment: Assignment;
  quote: Quote | null;
  location: Location | null;
  visibleActivity: ContractorPortalActivityEntry[];
}): ContractorPortalWorkOrderDetail {
  return {
    ...toContractorPortalWorkOrderListItem(input),
    description: input.workOrder.description,
    category: input.workOrder.category,
    locationContactName: input.location?.locationContactName ?? null,
    locationContactPhone: input.location?.locationContactPhone ?? null,
    locationContactEmail: input.location?.locationContactEmail ?? null,
    accessNotes: input.location?.accessNotes ?? null,
    quote: input.quote ? toContractorPortalQuoteSummary(input.quote) : null,
    visibleActivity: input.visibleActivity,
    actionAvailability: getContractorPortalActionAvailability(input),
  };
}

export function toContractorPortalActivityEntry(
  activity: ActivityLog,
): ContractorPortalActivityEntry {
  return {
    id: activity.id,
    message: activity.message,
    createdAt: activity.occurredAt,
    actorLabel: getActivityActorLabel(activity),
  };
}

function toContractorPortalAssignmentSummary(
  assignment: Assignment,
): ContractorPortalAssignmentSummary {
  return {
    id: assignment.id,
    status: assignment.status,
    assignedAt: assignment.assignedAt,
    acceptedAt: assignment.acceptedAt,
    declinedAt: assignment.declinedAt,
    completedAt: assignment.completedAt,
    scheduledDate: assignment.scheduledDate,
    timeWindowStart: assignment.timeWindowStart,
    timeWindowEnd: assignment.timeWindowEnd,
  };
}

function getActivityActorLabel(activity: ActivityLog): string {
  if (activity.actor.type === "system") {
    return "System";
  }

  switch (activity.actor.role) {
    case "coordinator":
      return "Coordinator";
    case "manager":
      return "Manager";
    case "finance_admin":
      return "Finance";
    case "owner":
      return "Owner";
    case "client_user":
      return "Client";
    case "contractor_user":
      return "Contractor";
    default:
      return "Team";
  }
}
