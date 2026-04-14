import type { InternalUserRole } from "../../types/permissions.ts";
import { USER_ROLES } from "../../types/permissions.ts";
import type { Quote } from "../../types/quote.ts";
import type { PhaseOneWorkOrder } from "../../types/work-order.ts";
import { isTerminalWorkOrderStatus } from "../work-orders/status.ts";

function isOwner(role: InternalUserRole): boolean {
  return role === USER_ROLES.Owner;
}

function isCoordinator(role: InternalUserRole): boolean {
  return role === USER_ROLES.Coordinator;
}

function isManager(role: InternalUserRole): boolean {
  return role === USER_ROLES.Manager;
}

function isQuoteOperator(role: InternalUserRole): boolean {
  return isCoordinator(role) || isManager(role) || isOwner(role);
}

function isQuoteDecisionMaker(role: InternalUserRole): boolean {
  return isManager(role) || isOwner(role);
}

function isQuoteReadRole(role: InternalUserRole): boolean {
  return (
    isQuoteOperator(role) ||
    role === USER_ROLES.FinanceAdmin
  );
}

function isWorkOrderQuoteMutable(workOrder: PhaseOneWorkOrder): boolean {
  return !isTerminalWorkOrderStatus(workOrder.status);
}

function isCurrentQuote(workOrder: PhaseOneWorkOrder, quote: Quote): boolean {
  return workOrder.currentQuoteId === quote.id;
}

export function canMarkRequiresQuote(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
): boolean {
  return isQuoteOperator(role) && isWorkOrderQuoteMutable(workOrder);
}

export function canRequestQuote(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
): boolean {
  return (
    isQuoteOperator(role) &&
    isWorkOrderQuoteMutable(workOrder) &&
    workOrder.requiresQuote &&
    (workOrder.status === "in_review" ||
      workOrder.status === "quote_received" ||
      workOrder.status === "pending_client_approval")
  );
}

export function canCreateQuote(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
): boolean {
  return (
    isQuoteOperator(role) &&
    isWorkOrderQuoteMutable(workOrder) &&
    workOrder.requiresQuote &&
    workOrder.status === "quote_requested" &&
    workOrder.currentQuoteId === null
  );
}

export function canEditQuote(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  quote: Quote,
): boolean {
  return (
    isQuoteOperator(role) &&
    isWorkOrderQuoteMutable(workOrder) &&
    isCurrentQuote(workOrder, quote) &&
    quote.status === "draft"
  );
}

export function canSubmitQuote(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  quote: Quote,
): boolean {
  return canEditQuote(role, workOrder, quote);
}

export function canReviewQuote(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  quote: Quote,
): boolean {
  return (
    isQuoteDecisionMaker(role) &&
    isWorkOrderQuoteMutable(workOrder) &&
    isCurrentQuote(workOrder, quote) &&
    (quote.status === "submitted" || quote.status === "under_review")
  );
}

export function canSendQuoteToClient(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  quote: Quote,
): boolean {
  return (
    canReviewQuote(role, workOrder, quote) &&
    quote.status === "under_review" &&
    workOrder.status === "quote_received"
  );
}

export function canRecordClientApproval(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  quote: Quote,
): boolean {
  return (
    isQuoteDecisionMaker(role) &&
    isWorkOrderQuoteMutable(workOrder) &&
    isCurrentQuote(workOrder, quote) &&
    workOrder.status === "pending_client_approval" &&
    quote.status === "ready_for_client"
  );
}

export function canRecordClientRejection(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  quote: Quote,
): boolean {
  return canRecordClientApproval(role, workOrder, quote);
}

export function canCreateQuoteRevision(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  quote: Quote,
): boolean {
  return (
    isQuoteOperator(role) &&
    isWorkOrderQuoteMutable(workOrder) &&
    isCurrentQuote(workOrder, quote) &&
    (quote.status === "client_rejected" ||
      quote.status === "submitted" ||
      quote.status === "under_review" ||
      quote.status === "ready_for_client")
  );
}

export function canViewQuoteHistory(
  role: InternalUserRole,
  _workOrder: PhaseOneWorkOrder,
): boolean {
  void _workOrder;
  return isQuoteReadRole(role);
}
