import type { AccessActor } from "../../types/auth.ts";
import { USER_ROLES, type UserRole } from "../../types/permissions.ts";
import type { QuoteStatus } from "../../types/quote.ts";
import type {
  ActivityLog,
  Quote,
  WorkOrder,
} from "../../server/repositories/firestore/models.ts";

export function safeQuoteSummaryForActor(actor: AccessActor, quote: Quote) {
  if (actor.actorType === "internal") {
    return {
      id: quote.id,
      workOrderId: quote.workOrderId,
      clientOrganizationId: quote.clientOrganizationId,
      locationId: quote.locationId,
      contractorOrganizationId: quote.contractorOrganizationId,
      versionNumber: quote.versionNumber,
      status: quote.status,
      laborAmount: quote.laborAmount,
      materialAmount: quote.materialAmount,
      otherAmount: quote.otherAmount,
      totalAmount: quote.totalAmount,
      currency: quote.currency,
      scopeSummary: quote.scopeSummary,
      contractorNotes: quote.contractorNotes,
      internalReviewNotes: quote.internalReviewNotes,
      clientResponseNotes: quote.clientResponseNotes,
      submittedByUserId: quote.submittedByUserId,
      submittedAt: quote.submittedAt,
      reviewedAt: quote.reviewedAt,
      clientDecisionAt: quote.clientDecisionAt,
      contractorSnapshot: quote.contractorSnapshot,
      workOrderSnapshot: quote.workOrderSnapshot,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
    };
  }

  if (actor.actorType === "contractor") {
    return {
      id: quote.id,
      workOrderId: quote.workOrderId,
      versionNumber: quote.versionNumber,
      status: quote.status,
      laborAmount: quote.laborAmount,
      materialAmount: quote.materialAmount,
      otherAmount: quote.otherAmount,
      totalAmount: quote.totalAmount,
      currency: quote.currency,
      scopeSummary: quote.scopeSummary,
      contractorNotes: quote.contractorNotes,
      submittedAt: quote.submittedAt,
      reviewedAt: quote.reviewedAt,
      contractorSnapshot: quote.contractorSnapshot,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
    };
  }

  return {
    id: quote.id,
    workOrderId: quote.workOrderId,
    versionNumber: quote.versionNumber,
    status: quote.status,
    totalAmount: quote.totalAmount,
    currency: quote.currency,
    scopeSummary: quote.scopeSummary,
    submittedAt: quote.submittedAt,
    reviewedAt: quote.reviewedAt,
    clientDecisionAt: quote.clientDecisionAt,
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
  quote: Quote,
): boolean {
  if (actor.actorType === "internal") {
    return true;
  }

  if (actor.actorType === "contractor") {
    return (
      isAssignedContractorActorForWorkOrder(actor, workOrder) &&
      (quote.contractorOrganizationId === null ||
        quote.contractorOrganizationId === actor.scope.contractorOrganizationId)
    );
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
  quote: Quote,
  toStatus: QuoteStatus,
): boolean {
  if (quote.id !== workOrder.currentQuoteId) {
    return false;
  }

  if (quote.status === "draft" && toStatus === "submitted") {
    return canActorEditDraftQuote(actor, workOrder, quote);
  }

  if (quote.status === "submitted" && toStatus === "under_review") {
    return actor.actorType === "internal" && isManagerialRole(actor.role);
  }

  if (quote.status === "under_review" && toStatus === "ready_for_client") {
    return actor.actorType === "internal" && isManagerialRole(actor.role);
  }

  if (
    quote.status === "ready_for_client" &&
    (toStatus === "client_approved" || toStatus === "client_rejected")
  ) {
    return actor.actorType === "client";
  }

  return false;
}

function canActorEditDraftQuote(
  actor: AccessActor,
  workOrder: WorkOrder,
  quote: Quote,
): boolean {
  if (actor.actorType === "internal") {
    return true;
  }

  return (
    actor.actorType === "contractor" &&
    isAssignedContractorActorForWorkOrder(actor, workOrder) &&
    (quote.contractorOrganizationId === null ||
      quote.contractorOrganizationId === actor.scope.contractorOrganizationId)
  );
}

function isAssignedContractorActorForWorkOrder(
  actor: AccessActor,
  workOrder: WorkOrder,
): boolean {
  return (
    actor.actorType === "contractor" &&
    workOrder.assignedContractorOrganizationId ===
      actor.scope.contractorOrganizationId
  );
}

function canClientSeeQuoteStatus(status: QuoteStatus): boolean {
  return (
    status === "ready_for_client" ||
    status === "client_approved" ||
    status === "client_rejected"
  );
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
