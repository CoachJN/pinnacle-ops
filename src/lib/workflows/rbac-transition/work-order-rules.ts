import {
  isActiveWorkOrderStatus,
  isNonTerminalWorkOrderStatus,
  WORK_ORDER_STATUS,
  type WorkOrderLifecycleStatus,
} from "../lifecycle/index.ts";
import { PLATFORM_ROLES, TRANSITION_ACTOR_TYPES } from "./role-types.ts";
import type {
  RoleTransitionAuthorizationDecision,
  RoleTransitionAuthorizationInput,
} from "./types.ts";

type WorkOrderPair = readonly [WorkOrderLifecycleStatus, WorkOrderLifecycleStatus];

const coordinatorWorkOrderTransitions = [
  [WORK_ORDER_STATUS.New, WORK_ORDER_STATUS.Triage],
  [WORK_ORDER_STATUS.Triage, WORK_ORDER_STATUS.QuotingRequired],
  [WORK_ORDER_STATUS.QuotingRequired, WORK_ORDER_STATUS.AwaitingQuote],
  [WORK_ORDER_STATUS.AwaitingQuote, WORK_ORDER_STATUS.QuoteReceived],
  [WORK_ORDER_STATUS.ApprovedToProceed, WORK_ORDER_STATUS.Scheduling],
  [WORK_ORDER_STATUS.Scheduling, WORK_ORDER_STATUS.Scheduled],
  [WORK_ORDER_STATUS.InProgress, WORK_ORDER_STATUS.WorkCompleted],
] as const satisfies readonly WorkOrderPair[];

const managerWorkOrderTransitions = [
  [WORK_ORDER_STATUS.Triage, WORK_ORDER_STATUS.QuotingRequired],
  [WORK_ORDER_STATUS.Triage, WORK_ORDER_STATUS.ApprovedToProceed],
  [WORK_ORDER_STATUS.QuoteReceived, WORK_ORDER_STATUS.QuoteReview],
  [WORK_ORDER_STATUS.QuoteReview, WORK_ORDER_STATUS.AwaitingClientApproval],
  [WORK_ORDER_STATUS.AwaitingClientApproval, WORK_ORDER_STATUS.ApprovedToProceed],
  [WORK_ORDER_STATUS.WorkCompleted, WORK_ORDER_STATUS.QaReview],
  [WORK_ORDER_STATUS.QaReview, WORK_ORDER_STATUS.ReadyForInvoicing],
  [WORK_ORDER_STATUS.Escalated, WORK_ORDER_STATUS.Triage],
] as const satisfies readonly WorkOrderPair[];

const financeAdminWorkOrderTransitions = [
  [WORK_ORDER_STATUS.ReadyForInvoicing, WORK_ORDER_STATUS.Completed],
] as const satisfies readonly WorkOrderPair[];

const contractorWorkOrderTransitions = [
  [WORK_ORDER_STATUS.Scheduled, WORK_ORDER_STATUS.InProgress],
  [WORK_ORDER_STATUS.InProgress, WORK_ORDER_STATUS.WorkCompleted],
] as const satisfies readonly WorkOrderPair[];

export function isRoleAllowedForWorkOrderTransition(
  input: RoleTransitionAuthorizationInput<WorkOrderLifecycleStatus>,
): RoleTransitionAuthorizationDecision {
  if (input.actorType === TRANSITION_ACTOR_TYPES.System) {
    return denied(
      `SYSTEM may not trigger work-order transition ${input.from} -> ${input.to}.`,
    );
  }

  if (!input.role) {
    return denied("USER work-order transitions require a role.");
  }

  if (input.role === PLATFORM_ROLES.Owner) {
    return {
      allowed: true,
      message: `OWNER may trigger valid work-order transition ${input.from} -> ${input.to}.`,
    };
  }

  const allowed =
    (input.role === PLATFORM_ROLES.Coordinator &&
      (hasPair(coordinatorWorkOrderTransitions, input) ||
        isActiveExceptionTransition(input))) ||
    (input.role === PLATFORM_ROLES.Manager &&
      (hasPair(managerWorkOrderTransitions, input) ||
        isActiveExceptionTransition(input) ||
        isManagerCancellation(input))) ||
    (input.role === PLATFORM_ROLES.FinanceAdmin &&
      hasPair(financeAdminWorkOrderTransitions, input)) ||
    (input.role === PLATFORM_ROLES.ContractorUser &&
      hasPair(contractorWorkOrderTransitions, input));

  if (allowed) {
    return {
      allowed: true,
      message: `${input.role} may trigger work-order transition ${input.from} -> ${input.to}.`,
    };
  }

  return denied(
    `${input.role} may not trigger work-order transition ${input.from} -> ${input.to}.`,
  );
}

function isActiveExceptionTransition(
  input: RoleTransitionAuthorizationInput<WorkOrderLifecycleStatus>,
): boolean {
  return (
    isActiveWorkOrderStatus(input.from) &&
    (input.to === WORK_ORDER_STATUS.OnHold ||
      input.to === WORK_ORDER_STATUS.Escalated)
  );
}

function isManagerCancellation(
  input: RoleTransitionAuthorizationInput<WorkOrderLifecycleStatus>,
): boolean {
  return (
    isNonTerminalWorkOrderStatus(input.from) &&
    input.to === WORK_ORDER_STATUS.Cancelled
  );
}

function hasPair(
  pairs: readonly WorkOrderPair[],
  input: RoleTransitionAuthorizationInput<WorkOrderLifecycleStatus>,
): boolean {
  return pairs.some(([from, to]) => from === input.from && to === input.to);
}

function denied(message: string): RoleTransitionAuthorizationDecision {
  return {
    allowed: false,
    failureCode: "ROLE_NOT_PERMITTED",
    message,
  };
}
