import type { InternalUserRole } from "../../types/permissions.ts";
import { USER_ROLES } from "../../types/permissions.ts";
import type {
  PhaseOneWorkOrder,
  PhaseOneWorkOrderStatus,
} from "../../types/work-order.ts";
import type { QuoteStatus } from "../../types/quote.ts";
import type { Invoice } from "../../types/invoice.ts";
import {
  canTransitionWorkOrderStatus,
  getAllowedStatusTransitions,
  isTerminalWorkOrderStatus,
} from "../work-orders/status.ts";
import {
  isFinanceCloseoutRole,
  isOperationalRole,
} from "./roles.ts";

export { parseInternalRole } from "./roles.ts";

export function canCreateWorkOrder(role: InternalUserRole): boolean {
  return isOperationalRole(role);
}

export function canViewWorkOrders(role: InternalUserRole): boolean {
  return (
    role === USER_ROLES.Coordinator ||
    role === USER_ROLES.Manager ||
    role === USER_ROLES.FinanceAdmin ||
    role === USER_ROLES.Owner
  );
}

export function canViewAllWorkOrders(role: InternalUserRole): boolean {
  return canViewWorkOrders(role);
}

export function canEditWorkOrder(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
): boolean {
  if (isTerminalWorkOrderStatus(workOrder.status)) {
    return false;
  }

  return isOperationalRole(role);
}

export function canTransitionWorkOrder(
  role: InternalUserRole,
  workOrderOrStatus: PhaseOneWorkOrder | PhaseOneWorkOrderStatus,
  nextStatus: PhaseOneWorkOrderStatus,
  context: {
    currentQuoteStatus?: QuoteStatus | null;
    currentInvoice?: Invoice | null;
  } = {},
): boolean {
  const currentStatus =
    typeof workOrderOrStatus === "string"
      ? workOrderOrStatus
      : workOrderOrStatus.status;

  if (!canTransitionWorkOrderStatus(currentStatus, nextStatus)) {
    return false;
  }

  if (
    typeof workOrderOrStatus !== "string" &&
    nextStatus === "dispatched" &&
    workOrderOrStatus.requiresQuote
  ) {
    return (
      currentStatus === "approved_to_proceed" &&
      context.currentQuoteStatus === "client_approved" &&
      isOperationalRole(role)
    );
  }

  if (nextStatus === "closed") {
    return (
      (currentStatus === "completed" ||
        (currentStatus === "paid" && context.currentInvoice?.status === "paid")) &&
      isFinanceCloseoutRole(role)
    );
  }

  if (nextStatus === "invoiced") {
    return (
      currentStatus === "completed" &&
      (context.currentInvoice?.status === "sent" ||
        context.currentInvoice?.status === "viewed") &&
      isFinanceCloseoutRole(role)
    );
  }

  if (nextStatus === "paid") {
    return (
      currentStatus === "invoiced" &&
      context.currentInvoice?.status === "paid" &&
      isFinanceCloseoutRole(role)
    );
  }

  if (nextStatus === "cancelled") {
    return isOperationalRole(role);
  }

  return isOperationalRole(role);
}

export function canCloseWorkOrder(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
  currentInvoice?: Invoice | null,
): boolean {
  return (
    (workOrder.status === "completed" ||
      (workOrder.status === "paid" && currentInvoice?.status === "paid")) &&
    isFinanceCloseoutRole(role)
  );
}

export function canCancelWorkOrder(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
): boolean {
  return (
    canTransitionWorkOrderStatus(workOrder.status, "cancelled") &&
    isOperationalRole(role)
  );
}

export function getRoleAllowedTransitions(
  role: InternalUserRole,
  workOrderOrStatus: PhaseOneWorkOrder | PhaseOneWorkOrderStatus,
  context: {
    currentQuoteStatus?: QuoteStatus | null;
    currentInvoice?: Invoice | null;
  } = {},
): readonly PhaseOneWorkOrderStatus[] {
  const currentStatus =
    typeof workOrderOrStatus === "string"
      ? workOrderOrStatus
      : workOrderOrStatus.status;

  return getAllowedStatusTransitions(currentStatus).filter((nextStatus) =>
    canTransitionWorkOrder(role, workOrderOrStatus, nextStatus, context),
  );
}

export function getDeniedTransitionMessage(
  role: InternalUserRole,
  from: PhaseOneWorkOrderStatus,
  to: PhaseOneWorkOrderStatus,
): string {
  if (!canTransitionWorkOrderStatus(from, to)) {
    return `Work orders cannot transition from ${from} to ${to}.`;
  }

  if (to === "closed") {
    return "Only Finance/Admin or Owner can close paid work orders with a paid current invoice.";
  }

  if (to === "invoiced" || to === "paid") {
    return "Finance workflow transitions require a valid current invoice in the matching state.";
  }

  if (to === "cancelled") {
    return "Only Coordinator, Manager, or Owner can cancel eligible work orders.";
  }

  return `${role} cannot move this work order to ${to}.`;
}
