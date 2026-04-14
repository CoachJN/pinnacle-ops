import type { Contractor, ContractorSessionContext } from "../../types/contractor.ts";
import type { Quote } from "../../types/quote.ts";
import type {
  InternalUserRole,
  UserRole,
} from "../../types/permissions.ts";
import { USER_ROLES } from "../../types/permissions.ts";
import type {
  PhaseOneWorkOrder,
  PhaseOneWorkOrderStatus,
} from "../../types/work-order.ts";
import { isTerminalWorkOrderStatus } from "../work-orders/status.ts";
import { isOperationalRole } from "./roles.ts";

export function canViewContractorModule(role: InternalUserRole): boolean {
  return (
    isOperationalRole(role) ||
    role === USER_ROLES.FinanceAdmin ||
    role === USER_ROLES.Owner
  );
}

export function canCreateContractor(role: InternalUserRole): boolean {
  return isOperationalRole(role);
}

export function canEditContractor(
  role: InternalUserRole,
  _contractor: Contractor,
): boolean {
  void _contractor;
  return isOperationalRole(role);
}

export function canAssignContractor(
  role: InternalUserRole,
  workOrder: PhaseOneWorkOrder,
): boolean {
  return isOperationalRole(role) && !isTerminalWorkOrderStatus(workOrder.status);
}

export function canViewContractorWorkOrder(
  role: UserRole,
  workOrder: PhaseOneWorkOrder,
  sessionContext: ContractorSessionContext | null,
): boolean {
  return (
    role === USER_ROLES.ContractorUser &&
    Boolean(sessionContext?.contractorId) &&
    workOrder.assignedContractorId === sessionContext?.contractorId
  );
}

export function canSubmitContractorQuote(
  role: UserRole,
  workOrder: PhaseOneWorkOrder,
  sessionContext: ContractorSessionContext | null,
): boolean {
  return (
    canViewContractorWorkOrder(role, workOrder, sessionContext) &&
    workOrder.status === "quote_requested" &&
    workOrder.requiresQuote &&
    !isTerminalWorkOrderStatus(workOrder.status)
  );
}

export function canEditContractorQuote(
  role: UserRole,
  workOrder: PhaseOneWorkOrder,
  quote: Quote,
  sessionContext: ContractorSessionContext | null,
): boolean {
  return (
    canSubmitContractorQuote(role, workOrder, sessionContext) &&
    workOrder.currentQuoteId === quote.id &&
    quote.status === "draft" &&
    quote.assignedContractorId === sessionContext?.contractorId
  );
}

export function canUpdateContractorExecutionStatus(
  role: UserRole,
  workOrder: PhaseOneWorkOrder,
  sessionContext: ContractorSessionContext | null,
  nextStatus: PhaseOneWorkOrderStatus,
): boolean {
  if (!canViewContractorWorkOrder(role, workOrder, sessionContext)) {
    return false;
  }

  if (isTerminalWorkOrderStatus(workOrder.status)) {
    return false;
  }

  if (nextStatus === "in_progress") {
    return (
      workOrder.status === "approved_to_proceed" ||
      workOrder.status === "dispatched"
    );
  }

  if (nextStatus === "completed") {
    return workOrder.status === "in_progress";
  }

  return false;
}

export function canAddContractorCompletionNotes(
  role: UserRole,
  workOrder: PhaseOneWorkOrder,
  sessionContext: ContractorSessionContext | null,
): boolean {
  return canUpdateContractorExecutionStatus(
    role,
    workOrder,
    sessionContext,
    "completed",
  );
}
