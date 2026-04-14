import { canTransition, includesStatus, type LifecycleTransitionMap } from "./types.ts";
import {
  ACTIVE_WORK_ORDER_STATUSES,
  NON_TERMINAL_WORK_ORDER_STATUSES,
  TERMINAL_WORK_ORDER_STATUSES,
  WORK_ORDER_STATUS,
  type WorkOrderLifecycleStatus,
} from "./work-order-status.ts";

const workOrderOnHoldReturnStatuses = [
  WORK_ORDER_STATUS.Triage,
  WORK_ORDER_STATUS.AwaitingQuote,
  WORK_ORDER_STATUS.QuoteReview,
  WORK_ORDER_STATUS.AwaitingClientApproval,
  WORK_ORDER_STATUS.ApprovedToProceed,
  WORK_ORDER_STATUS.Scheduling,
  WORK_ORDER_STATUS.Scheduled,
  WORK_ORDER_STATUS.InProgress,
  WORK_ORDER_STATUS.WorkCompleted,
  WORK_ORDER_STATUS.QaReview,
] as const satisfies readonly WorkOrderLifecycleStatus[];

// Phase 1 does not persist the previous active state, so ON_HOLD can return
// only to the approved logical resume points.
function withWorkOrderExceptions(
  status: WorkOrderLifecycleStatus,
  next: readonly WorkOrderLifecycleStatus[],
): readonly WorkOrderLifecycleStatus[] {
  if (!includesStatus<WorkOrderLifecycleStatus>(ACTIVE_WORK_ORDER_STATUSES, status)) {
    return next;
  }

  return [
    ...next,
    WORK_ORDER_STATUS.OnHold,
    WORK_ORDER_STATUS.Escalated,
    WORK_ORDER_STATUS.Cancelled,
  ];
}

export const WORK_ORDER_TRANSITION_MAP = {
  [WORK_ORDER_STATUS.New]: withWorkOrderExceptions(WORK_ORDER_STATUS.New, [
    WORK_ORDER_STATUS.Triage,
  ]),
  [WORK_ORDER_STATUS.Triage]: withWorkOrderExceptions(WORK_ORDER_STATUS.Triage, [
    WORK_ORDER_STATUS.QuotingRequired,
    WORK_ORDER_STATUS.ApprovedToProceed,
  ]),
  [WORK_ORDER_STATUS.QuotingRequired]: withWorkOrderExceptions(
    WORK_ORDER_STATUS.QuotingRequired,
    [WORK_ORDER_STATUS.AwaitingQuote],
  ),
  [WORK_ORDER_STATUS.AwaitingQuote]: withWorkOrderExceptions(
    WORK_ORDER_STATUS.AwaitingQuote,
    [WORK_ORDER_STATUS.QuoteReceived],
  ),
  [WORK_ORDER_STATUS.QuoteReceived]: withWorkOrderExceptions(
    WORK_ORDER_STATUS.QuoteReceived,
    [WORK_ORDER_STATUS.QuoteReview],
  ),
  [WORK_ORDER_STATUS.QuoteReview]: withWorkOrderExceptions(
    WORK_ORDER_STATUS.QuoteReview,
    [WORK_ORDER_STATUS.AwaitingClientApproval],
  ),
  [WORK_ORDER_STATUS.AwaitingClientApproval]: withWorkOrderExceptions(
    WORK_ORDER_STATUS.AwaitingClientApproval,
    [WORK_ORDER_STATUS.ApprovedToProceed],
  ),
  [WORK_ORDER_STATUS.ApprovedToProceed]: withWorkOrderExceptions(
    WORK_ORDER_STATUS.ApprovedToProceed,
    [WORK_ORDER_STATUS.Scheduling],
  ),
  [WORK_ORDER_STATUS.Scheduling]: withWorkOrderExceptions(
    WORK_ORDER_STATUS.Scheduling,
    [WORK_ORDER_STATUS.Scheduled],
  ),
  [WORK_ORDER_STATUS.Scheduled]: withWorkOrderExceptions(
    WORK_ORDER_STATUS.Scheduled,
    [WORK_ORDER_STATUS.InProgress],
  ),
  [WORK_ORDER_STATUS.InProgress]: withWorkOrderExceptions(
    WORK_ORDER_STATUS.InProgress,
    [WORK_ORDER_STATUS.WorkCompleted],
  ),
  [WORK_ORDER_STATUS.WorkCompleted]: withWorkOrderExceptions(
    WORK_ORDER_STATUS.WorkCompleted,
    [WORK_ORDER_STATUS.QaReview],
  ),
  [WORK_ORDER_STATUS.QaReview]: withWorkOrderExceptions(
    WORK_ORDER_STATUS.QaReview,
    [WORK_ORDER_STATUS.ReadyForInvoicing],
  ),
  [WORK_ORDER_STATUS.ReadyForInvoicing]: withWorkOrderExceptions(
    WORK_ORDER_STATUS.ReadyForInvoicing,
    [WORK_ORDER_STATUS.Completed],
  ),
  [WORK_ORDER_STATUS.Completed]: [],
  [WORK_ORDER_STATUS.OnHold]: [
    ...workOrderOnHoldReturnStatuses,
    WORK_ORDER_STATUS.Cancelled,
  ],
  [WORK_ORDER_STATUS.Escalated]: [
    WORK_ORDER_STATUS.Triage,
    WORK_ORDER_STATUS.Cancelled,
  ],
  [WORK_ORDER_STATUS.Cancelled]: [],
} as const satisfies LifecycleTransitionMap<WorkOrderLifecycleStatus>;

export function isTerminalWorkOrderStatus(
  status: WorkOrderLifecycleStatus,
): boolean {
  return includesStatus(TERMINAL_WORK_ORDER_STATUSES, status);
}

export function isActiveWorkOrderStatus(
  status: WorkOrderLifecycleStatus,
): boolean {
  return includesStatus(ACTIVE_WORK_ORDER_STATUSES, status);
}

export function isNonTerminalWorkOrderStatus(
  status: WorkOrderLifecycleStatus,
): boolean {
  return includesStatus(NON_TERMINAL_WORK_ORDER_STATUSES, status);
}

export function canWorkOrderTransition(
  from: WorkOrderLifecycleStatus,
  to: WorkOrderLifecycleStatus,
): boolean {
  return canTransition(WORK_ORDER_TRANSITION_MAP, from, to);
}
