import {
  isNonTerminalQuoteStatus,
  QUOTE_STATUS,
  type QuoteLifecycleStatus,
} from "../lifecycle/index.ts";
import { PLATFORM_ROLES, TRANSITION_ACTOR_TYPES } from "./role-types.ts";
import type {
  RoleTransitionAuthorizationDecision,
  RoleTransitionAuthorizationInput,
} from "./types.ts";

type QuotePair = readonly [QuoteLifecycleStatus, QuoteLifecycleStatus];

const contractorQuoteTransitions = [
  [QUOTE_STATUS.Requested, QUOTE_STATUS.Submitted],
] as const satisfies readonly QuotePair[];

const coordinatorQuoteTransitions = [
  [QUOTE_STATUS.Submitted, QUOTE_STATUS.UnderReview],
] as const satisfies readonly QuotePair[];

const managerQuoteTransitions = [
  [QUOTE_STATUS.UnderReview, QUOTE_STATUS.Rejected],
  [QUOTE_STATUS.UnderReview, QUOTE_STATUS.ApprovedInternal],
  [QUOTE_STATUS.Rejected, QUOTE_STATUS.Requested],
  [QUOTE_STATUS.ApprovedInternal, QUOTE_STATUS.SentToClient],
] as const satisfies readonly QuotePair[];

const clientQuoteTransitions = [
  [QUOTE_STATUS.SentToClient, QUOTE_STATUS.ClientApproved],
  [QUOTE_STATUS.SentToClient, QUOTE_STATUS.ClientRejected],
] as const satisfies readonly QuotePair[];

export function isRoleAllowedForQuoteTransition(
  input: RoleTransitionAuthorizationInput<QuoteLifecycleStatus>,
): RoleTransitionAuthorizationDecision {
  if (input.actorType === TRANSITION_ACTOR_TYPES.System) {
    return denied(
      `SYSTEM may not trigger quote transition ${input.from} -> ${input.to}.`,
    );
  }

  if (!input.role) {
    return denied("USER quote transitions require a role.");
  }

  if (input.role === PLATFORM_ROLES.Owner) {
    return {
      allowed: true,
      message: `OWNER may trigger valid quote transition ${input.from} -> ${input.to}.`,
    };
  }

  const allowed =
    (input.role === PLATFORM_ROLES.ContractorUser &&
      hasPair(contractorQuoteTransitions, input)) ||
    (input.role === PLATFORM_ROLES.Coordinator &&
      hasPair(coordinatorQuoteTransitions, input)) ||
    (input.role === PLATFORM_ROLES.Manager &&
      (hasPair(managerQuoteTransitions, input) || isManagerCancellation(input))) ||
    (input.role === PLATFORM_ROLES.ClientUser &&
      hasPair(clientQuoteTransitions, input));

  if (allowed) {
    return {
      allowed: true,
      message: `${input.role} may trigger quote transition ${input.from} -> ${input.to}.`,
    };
  }

  return denied(`${input.role} may not trigger quote transition ${input.from} -> ${input.to}.`);
}

function isManagerCancellation(
  input: RoleTransitionAuthorizationInput<QuoteLifecycleStatus>,
): boolean {
  return isNonTerminalQuoteStatus(input.from) && input.to === QUOTE_STATUS.Cancelled;
}

function hasPair(
  pairs: readonly QuotePair[],
  input: RoleTransitionAuthorizationInput<QuoteLifecycleStatus>,
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
