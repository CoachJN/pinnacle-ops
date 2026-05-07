import "server-only";

import type { CommunicationTimelineEntry } from "@/modules/communications";
import type {
  Assignment,
  ContractorQuote,
  Location,
  WorkOrder,
} from "@/server/repositories";
import type { TimelineEntry } from "@/server/events/types";
import type { ContactSummary } from "@/types/contact";
import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { ContractorQuoteStatus } from "@/types/quote";
import type { AssignmentStatus, WorkOrderPriority, WorkOrderStatus } from "@/types/work-order";
import {
  toContractorPortalQuoteSummary,
  type ContractorPortalQuoteSummary,
} from "@/modules/quotes/contractor-portal";

export type ContractorWorkOrderFilter =
  | "all"
  | "quote_required"
  | "client_approved"
  | "in_progress"
  | "work_completed";

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
  lifecycleStatus: WorkOrderStatus;
  priority: WorkOrderPriority;
  requestedServiceDate: IsoDateTimeString | null;
  updatedAt: IsoDateTimeString;
  assignment: ContractorPortalAssignmentSummary;
  quoteStatus: ContractorQuoteStatus | null;
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
  communications: CommunicationTimelineEntry[];
  actionAvailability: ContractorPortalActionAvailability;
}

export function matchesContractorPortalFilter(
  item: ContractorPortalWorkOrderListItem,
  filter: ContractorWorkOrderFilter,
): boolean {
  if (filter === "all") {
    return true;
  }

  if (filter === "client_approved") {
    return (
      item.lifecycleStatus === "client_approved" ||
      item.lifecycleStatus === "assigned" ||
      item.lifecycleStatus === "awaiting_contractor_response" ||
      item.lifecycleStatus === "contractor_scheduled"
    );
  }

  if (filter === "work_completed") {
    return item.lifecycleStatus === "work_completed" || item.lifecycleStatus === "closed";
  }

  return item.lifecycleStatus === filter;
}

export function getContractorPortalActionAvailability(input: {
  workOrder: WorkOrder;
  assignment: Assignment;
  quote: ContractorQuote | null;
}): ContractorPortalActionAvailability {
  const canRespondToAssignment = input.assignment.status === "assigned";
  const hasEditableQuote =
    input.quote !== null &&
    (input.quote.status === "draft" || input.quote.status === "rejected");

  return {
    canAcceptAssignment: canRespondToAssignment,
    canDeclineAssignment: canRespondToAssignment,
    canCompleteAssignment:
      input.assignment.status === "accepted" &&
      input.workOrder.lifecycleStatus !== "work_completed" &&
      input.workOrder.lifecycleStatus !== "closed" &&
      input.workOrder.lifecycleStatus !== "cancelled",
    canSubmitQuote:
      input.workOrder.lifecycleStatus === "quote_required" &&
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
  quote: ContractorQuote | null;
}): ContractorPortalWorkOrderListItem {
  const actionAvailability = getContractorPortalActionAvailability(input);

  return {
    id: input.workOrder.id,
    workOrderNumber: input.workOrder.workOrderNumber,
    title: input.workOrder.title,
    clientName: input.workOrder.clientSnapshot.name,
    locationName: input.workOrder.locationSnapshot.name,
    serviceAddress: input.workOrder.locationSnapshot.addressText ?? "Address unavailable",
    lifecycleStatus: input.workOrder.lifecycleStatus,
    priority: input.workOrder.priority,
    requestedServiceDate: input.workOrder.requestedServiceDate ?? null,
    updatedAt: input.workOrder.updatedAt,
    assignment: toContractorPortalAssignmentSummary(input.assignment),
    quoteStatus: input.quote?.status ?? null,
    quoteActionNeeded: actionAvailability.canSubmitQuote,
  };
}

export function toContractorPortalWorkOrderDetail(input: {
  workOrder: WorkOrder;
  assignment: Assignment;
  quote: ContractorQuote | null;
  location: Location | null;
  siteContact: ContactSummary | null;
  visibleActivity: ContractorPortalActivityEntry[];
  communications: CommunicationTimelineEntry[];
}): ContractorPortalWorkOrderDetail {
  return {
    ...toContractorPortalWorkOrderListItem(input),
    description: input.workOrder.description,
    category: input.workOrder.category ?? null,
    locationContactName: input.siteContact?.displayName ?? null,
    locationContactPhone: input.siteContact?.primaryPhone ?? null,
    locationContactEmail: input.siteContact?.email ?? null,
    accessNotes: input.location?.accessNotes ?? null,
    quote: input.quote ? toContractorPortalQuoteSummary(input.quote) : null,
    visibleActivity: input.visibleActivity,
    communications: input.communications,
    actionAvailability: getContractorPortalActionAvailability(input),
  };
}

export function toContractorPortalActivityEntry(
  activity: TimelineEntry,
): ContractorPortalActivityEntry {
  return {
    id: activity.id,
    message: activity.summary,
    createdAt: activity.occurredAt,
    actorLabel: activity.actor.displayName ?? "System",
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
