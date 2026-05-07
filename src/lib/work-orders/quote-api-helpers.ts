import type { AccessActor } from "../../types/auth.ts";
import { USER_ROLES, type UserRole } from "../../types/permissions.ts";
import type { ClientQuoteStatus } from "../../types/quote.ts";
import type {
  ActivityLog,
  ClientQuote,
  WorkOrder,
} from "../../server/repositories/firestore/models.ts";

export function safeQuoteSummaryForActor(actor: AccessActor, quote: ClientQuote) {
  if (actor.actorType === "internal") {
    return {
      id: quote.id,
      workOrderId: quote.workOrderId,
      clientOrganizationId: quote.clientOrganizationId,
      locationId: quote.locationId,
      sourceContractorQuoteId: quote.sourceContractorQuoteId,
      status: quote.status,
      lineItems: quote.lineItems,
      subtotal: quote.subtotal,
      taxAmount: quote.taxAmount,
      totalAmount: quote.totalAmount,
      notes: quote.notes,
      sentAt: quote.sentAt,
      respondedAt: quote.respondedAt,
      approvedAt: quote.approvedAt,
      rejectedAt: quote.rejectedAt,
      rejectionReason: quote.rejectionReason,
      workOrderSnapshot: quote.workOrderSnapshot,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
    };
  }

  if (actor.actorType === "contractor") {
    return {
      id: quote.id,
      workOrderId: quote.workOrderId,
      status: quote.status,
      lineItems: quote.lineItems,
      subtotal: quote.subtotal,
      taxAmount: quote.taxAmount,
      totalAmount: quote.totalAmount,
      notes: quote.notes,
      sentAt: quote.sentAt,
      respondedAt: quote.respondedAt,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
    };
  }

  return {
    id: quote.id,
    workOrderId: quote.workOrderId,
    status: quote.status,
    subtotal: quote.subtotal,
    taxAmount: quote.taxAmount,
    totalAmount: quote.totalAmount,
    notes: quote.notes,
    sentAt: quote.sentAt,
    respondedAt: quote.respondedAt,
    approvedAt: quote.approvedAt,
    rejectedAt: quote.rejectedAt,
    createdAt: quote.createdAt,
    updatedAt: quote.updatedAt,
  };
}

export function filterVisibleActivityLogsForActor(
  actor: AccessActor,
  activity: ActivityLog[],
): ActivityLog[] {
  return activity.filter((entry) => canActorReadActivityLog(actor, entry));
}

export function canActorReadQuote(
  actor: AccessActor,
  workOrder: WorkOrder,
  quote: ClientQuote,
): boolean {
  if (actor.actorType === "internal") {
    return true;
  }

  if (actor.actorType === "contractor") {
    return isAssignedContractorActorForWorkOrder(actor, workOrder);
  }

  return (
    quote.id === workOrder.currentQuoteId &&
    quote.clientOrganizationId === actor.scope.clientOrganizationId &&
    canClientSeeQuoteStatus(quote.status)
  );
}

export function isAllowedQuoteTransitionForActor(
  actor: AccessActor,
  workOrder: WorkOrder,
  quote: ClientQuote,
  toStatus: ClientQuoteStatus,
): boolean {
  if (quote.id !== workOrder.currentQuoteId) {
    return false;
  }

  if (quote.status === "draft" && toStatus === "sent") {
    return canActorEditDraftQuote(actor, workOrder, quote);
  }

  if (quote.status === "sent" && (toStatus === "approved" || toStatus === "rejected")) {
    return actor.actorType === "client";
  }

  return false;
}

function canActorEditDraftQuote(
  actor: AccessActor,
  workOrder: WorkOrder,
  quote: ClientQuote,
): boolean {
  if (actor.actorType === "internal") {
    return true;
  }

  return (
    actor.actorType === "contractor" &&
    isAssignedContractorActorForWorkOrder(actor, workOrder)
  );
}

function isAssignedContractorActorForWorkOrder(
  actor: AccessActor,
  workOrder: WorkOrder,
): boolean {
  return (
    actor.actorType === "contractor" &&
    workOrder.assignedContractorId ===
      actor.scope.contractorOrganizationId
  );
}

function canClientSeeQuoteStatus(status: ClientQuoteStatus): boolean {
  return status === "sent" || status === "approved" || status === "rejected";
}

function canActorReadActivityLog(
  actor: AccessActor,
  activityLog: ActivityLog,
): boolean {
  if (actor.actorType === "internal") {
    return true;
  }

  if (actor.actorType === "client") {
    return (
      activityLog.visibility === "client" || activityLog.visibility === "all"
    );
  }

  return (
    activityLog.visibility === "contractor" || activityLog.visibility === "all"
  );
}

function isManagerialRole(role: UserRole): boolean {
  return role === USER_ROLES.Manager || role === USER_ROLES.Owner;
}
