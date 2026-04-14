import {
  canWorkOrderTransition,
  isTerminalWorkOrderStatus,
  QUOTE_STATUS,
  WORK_ORDER_STATUS,
  type WorkOrderLifecycleStatus,
} from "../lifecycle/index.ts";
import {
  normalizeQuoteStatusResult,
  normalizeWorkOrderStatusResult,
} from "./adapters.ts";
import { transitionFailure, transitionSuccess } from "./errors.ts";
import type {
  TransitionValidationResult,
  WorkOrderTransitionContext,
} from "./types.ts";

const quoteApprovalGatedWorkOrderStatuses = [
  WORK_ORDER_STATUS.ApprovedToProceed,
  WORK_ORDER_STATUS.Scheduling,
  WORK_ORDER_STATUS.Scheduled,
  WORK_ORDER_STATUS.InProgress,
] as const satisfies readonly WorkOrderLifecycleStatus[];

export function validateWorkOrderTransition(
  from: WorkOrderLifecycleStatus | string | null | undefined,
  to: WorkOrderLifecycleStatus | string | null | undefined,
  context: WorkOrderTransitionContext = {},
): TransitionValidationResult<"work-order", WorkOrderLifecycleStatus> {
  const normalizedFrom = normalizeWorkOrderStatusResult(from);
  const normalizedTo = normalizeWorkOrderStatusResult(to);

  if (!normalizedFrom.ok) {
    return transitionFailure(normalizedFrom.failureCode, {
      lifecycle: "work-order",
      from,
      to,
      message: normalizedFrom.message,
      details: { field: "from", original: normalizedFrom.original },
    });
  }

  if (!normalizedTo.ok) {
    return transitionFailure(normalizedTo.failureCode, {
      lifecycle: "work-order",
      from,
      to,
      normalizedFrom: normalizedFrom.status,
      message: normalizedTo.message,
      details: { field: "to", original: normalizedTo.original },
    });
  }

  const currentStatusTerminal = isTerminalWorkOrderStatus(normalizedFrom.status);
  if (currentStatusTerminal) {
    return transitionFailure("TERMINAL_STATE", {
      lifecycle: "work-order",
      from,
      to,
      normalizedFrom: normalizedFrom.status,
      normalizedTo: normalizedTo.status,
      currentStatusTerminal,
      message: `Work order status ${normalizedFrom.status} is terminal.`,
    });
  }

  if (!canWorkOrderTransition(normalizedFrom.status, normalizedTo.status)) {
    return transitionFailure("INVALID_TRANSITION", {
      lifecycle: "work-order",
      from,
      to,
      normalizedFrom: normalizedFrom.status,
      normalizedTo: normalizedTo.status,
      message: `Work order cannot transition from ${normalizedFrom.status} to ${normalizedTo.status}.`,
    });
  }

  const dependencyFailure = validateQuoteApprovalDependency(
    normalizedTo.status,
    context,
  );
  if (dependencyFailure) {
    return transitionFailure("DEPENDENCY_FAILED", {
      lifecycle: "work-order",
      from,
      to,
      normalizedFrom: normalizedFrom.status,
      normalizedTo: normalizedTo.status,
      message: dependencyFailure.message,
      details: dependencyFailure.details,
    });
  }

  return transitionSuccess({
    lifecycle: "work-order",
    from,
    to,
    normalizedFrom: normalizedFrom.status,
    normalizedTo: normalizedTo.status,
    message: `Work order transition ${normalizedFrom.status} -> ${normalizedTo.status} is allowed.`,
    details: {
      fromSource: normalizedFrom.source,
      toSource: normalizedTo.source,
    },
  });
}

function validateQuoteApprovalDependency(
  to: WorkOrderLifecycleStatus,
  context: WorkOrderTransitionContext,
):
  | { readonly message: string; readonly details: Record<string, unknown> }
  | undefined {
  if (
    !context.quoteRequired ||
    !(quoteApprovalGatedWorkOrderStatuses as readonly WorkOrderLifecycleStatus[])
      .includes(to)
  ) {
    return undefined;
  }

  const quoteStatus = normalizeQuoteStatusResult(context.quoteStatus);
  if (quoteStatus.ok && quoteStatus.status === QUOTE_STATUS.ClientApproved) {
    return undefined;
  }

  return {
    message: `Work order transition to ${to} requires an approved client quote.`,
    details: {
      dependency: "quote",
      requiredStatus: QUOTE_STATUS.ClientApproved,
      actualStatus: quoteStatus.ok ? quoteStatus.status : null,
      originalStatus: quoteStatus.original,
      dependencyFailureCode: quoteStatus.ok ? undefined : quoteStatus.failureCode,
    },
  };
}
