import { canTransition, includesStatus, type LifecycleTransitionMap } from "./types.ts";
import {
  NON_TERMINAL_QUOTE_STATUSES,
  QUOTE_STATUS,
  TERMINAL_QUOTE_STATUSES,
  type QuoteLifecycleStatus,
} from "./quote-status.ts";

function withQuoteCancellation(
  status: QuoteLifecycleStatus,
  next: readonly QuoteLifecycleStatus[],
): readonly QuoteLifecycleStatus[] {
  if (
    !includesStatus<QuoteLifecycleStatus>(NON_TERMINAL_QUOTE_STATUSES, status)
  ) {
    return next;
  }

  return [...next, QUOTE_STATUS.Cancelled];
}

export const QUOTE_TRANSITION_MAP = {
  [QUOTE_STATUS.Requested]: withQuoteCancellation(QUOTE_STATUS.Requested, [
    QUOTE_STATUS.Submitted,
  ]),
  [QUOTE_STATUS.Submitted]: withQuoteCancellation(QUOTE_STATUS.Submitted, [
    QUOTE_STATUS.UnderReview,
  ]),
  [QUOTE_STATUS.UnderReview]: withQuoteCancellation(QUOTE_STATUS.UnderReview, [
    QUOTE_STATUS.Rejected,
    QUOTE_STATUS.ApprovedInternal,
  ]),
  [QUOTE_STATUS.Rejected]: withQuoteCancellation(QUOTE_STATUS.Rejected, [
    QUOTE_STATUS.Requested,
  ]),
  [QUOTE_STATUS.ApprovedInternal]: withQuoteCancellation(
    QUOTE_STATUS.ApprovedInternal,
    [QUOTE_STATUS.SentToClient],
  ),
  [QUOTE_STATUS.SentToClient]: withQuoteCancellation(QUOTE_STATUS.SentToClient, [
    QUOTE_STATUS.ClientApproved,
    QUOTE_STATUS.ClientRejected,
    QUOTE_STATUS.Expired,
  ]),
  [QUOTE_STATUS.ClientApproved]: [],
  [QUOTE_STATUS.ClientRejected]: [],
  [QUOTE_STATUS.Expired]: [],
  [QUOTE_STATUS.Cancelled]: [],
} as const satisfies LifecycleTransitionMap<QuoteLifecycleStatus>;

export function isTerminalQuoteStatus(status: QuoteLifecycleStatus): boolean {
  return includesStatus(TERMINAL_QUOTE_STATUSES, status);
}

export function isNonTerminalQuoteStatus(status: QuoteLifecycleStatus): boolean {
  return includesStatus(NON_TERMINAL_QUOTE_STATUSES, status);
}

export function canQuoteTransition(
  from: QuoteLifecycleStatus,
  to: QuoteLifecycleStatus,
): boolean {
  return canTransition(QUOTE_TRANSITION_MAP, from, to);
}
