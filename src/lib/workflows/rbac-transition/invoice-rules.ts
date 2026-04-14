import {
  INVOICE_STATUS,
  isNonTerminalInvoiceStatus,
  type InvoiceLifecycleStatus,
} from "../lifecycle/index.ts";
import { PLATFORM_ROLES, TRANSITION_ACTOR_TYPES } from "./role-types.ts";
import type {
  RoleTransitionAuthorizationDecision,
  RoleTransitionAuthorizationInput,
} from "./types.ts";

type InvoicePair = readonly [InvoiceLifecycleStatus, InvoiceLifecycleStatus];

const financeAdminInvoiceTransitions = [
  [INVOICE_STATUS.NotReady, INVOICE_STATUS.Ready],
  [INVOICE_STATUS.Ready, INVOICE_STATUS.Draft],
  [INVOICE_STATUS.Draft, INVOICE_STATUS.Sent],
  [INVOICE_STATUS.Sent, INVOICE_STATUS.PartiallyPaid],
  [INVOICE_STATUS.Sent, INVOICE_STATUS.Paid],
  [INVOICE_STATUS.Viewed, INVOICE_STATUS.PartiallyPaid],
  [INVOICE_STATUS.Viewed, INVOICE_STATUS.Paid],
  [INVOICE_STATUS.Overdue, INVOICE_STATUS.PartiallyPaid],
  [INVOICE_STATUS.Overdue, INVOICE_STATUS.Paid],
] as const satisfies readonly InvoicePair[];

const systemOnlyInvoiceTransitions = [
  [INVOICE_STATUS.Sent, INVOICE_STATUS.Viewed],
  [INVOICE_STATUS.Sent, INVOICE_STATUS.Overdue],
  [INVOICE_STATUS.Viewed, INVOICE_STATUS.Overdue],
] as const satisfies readonly InvoicePair[];

export function isRoleAllowedForInvoiceTransition(
  input: RoleTransitionAuthorizationInput<InvoiceLifecycleStatus>,
): RoleTransitionAuthorizationDecision {
  if (hasPair(systemOnlyInvoiceTransitions, input)) {
    if (input.actorType === TRANSITION_ACTOR_TYPES.System) {
      return {
        allowed: true,
        message: `SYSTEM may trigger invoice transition ${input.from} -> ${input.to}.`,
      };
    }

    return {
      allowed: false,
      failureCode: "SYSTEM_ONLY_TRANSITION",
      message: `Invoice transition ${input.from} -> ${input.to} is SYSTEM-only.`,
    };
  }

  if (input.actorType === TRANSITION_ACTOR_TYPES.System) {
    return denied(
      `SYSTEM may not trigger invoice transition ${input.from} -> ${input.to}.`,
    );
  }

  if (!input.role) {
    return denied("USER invoice transitions require a role.");
  }

  if (input.role === PLATFORM_ROLES.Owner) {
    return {
      allowed: true,
      message: `OWNER may trigger valid invoice transition ${input.from} -> ${input.to}.`,
    };
  }

  const allowed =
    input.role === PLATFORM_ROLES.FinanceAdmin &&
    (hasPair(financeAdminInvoiceTransitions, input) || isFinanceVoiding(input));

  if (allowed) {
    return {
      allowed: true,
      message: `${input.role} may trigger invoice transition ${input.from} -> ${input.to}.`,
    };
  }

  return denied(
    `${input.role} may not trigger invoice transition ${input.from} -> ${input.to}.`,
  );
}

function isFinanceVoiding(
  input: RoleTransitionAuthorizationInput<InvoiceLifecycleStatus>,
): boolean {
  return isNonTerminalInvoiceStatus(input.from) && input.to === INVOICE_STATUS.Voided;
}

function hasPair(
  pairs: readonly InvoicePair[],
  input: Pick<RoleTransitionAuthorizationInput<InvoiceLifecycleStatus>, "from" | "to">,
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
