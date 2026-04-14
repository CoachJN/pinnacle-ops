import {
  canInvoiceTransition,
  INVOICE_STATUS,
  isTerminalInvoiceStatus,
  WORK_ORDER_STATUS,
  type InvoiceLifecycleStatus,
} from "../lifecycle/index.ts";
import {
  normalizeInvoiceStatusResult,
  normalizeWorkOrderStatusResult,
} from "./adapters.ts";
import { transitionFailure, transitionSuccess } from "./errors.ts";
import type {
  InvoiceTransitionContext,
  TransitionValidationResult,
} from "./types.ts";

const workOrderReadinessCheckedInvoiceStatuses = [
  INVOICE_STATUS.Ready,
  INVOICE_STATUS.Draft,
  INVOICE_STATUS.Sent,
] as const satisfies readonly InvoiceLifecycleStatus[];

export function validateInvoiceTransition(
  from: InvoiceLifecycleStatus | string | null | undefined,
  to: InvoiceLifecycleStatus | string | null | undefined,
  context: InvoiceTransitionContext = {},
): TransitionValidationResult<"invoice", InvoiceLifecycleStatus> {
  const normalizedFrom = normalizeInvoiceStatusResult(from);
  const normalizedTo = normalizeInvoiceStatusResult(to);

  if (!normalizedFrom.ok) {
    return transitionFailure(normalizedFrom.failureCode, {
      lifecycle: "invoice",
      from,
      to,
      message: normalizedFrom.message,
      details: { field: "from", original: normalizedFrom.original },
    });
  }

  if (!normalizedTo.ok) {
    return transitionFailure(normalizedTo.failureCode, {
      lifecycle: "invoice",
      from,
      to,
      normalizedFrom: normalizedFrom.status,
      message: normalizedTo.message,
      details: { field: "to", original: normalizedTo.original },
    });
  }

  const currentStatusTerminal = isTerminalInvoiceStatus(normalizedFrom.status);
  if (currentStatusTerminal) {
    return transitionFailure("TERMINAL_STATE", {
      lifecycle: "invoice",
      from,
      to,
      normalizedFrom: normalizedFrom.status,
      normalizedTo: normalizedTo.status,
      currentStatusTerminal,
      message: `Invoice status ${normalizedFrom.status} is terminal.`,
    });
  }

  if (!canInvoiceTransition(normalizedFrom.status, normalizedTo.status)) {
    return transitionFailure("INVALID_TRANSITION", {
      lifecycle: "invoice",
      from,
      to,
      normalizedFrom: normalizedFrom.status,
      normalizedTo: normalizedTo.status,
      message: `Invoice cannot transition from ${normalizedFrom.status} to ${normalizedTo.status}.`,
    });
  }

  const dependencyFailure = validateWorkOrderReadinessDependency(
    normalizedFrom.status,
    normalizedTo.status,
    context,
  );
  if (dependencyFailure) {
    return transitionFailure("DEPENDENCY_FAILED", {
      lifecycle: "invoice",
      from,
      to,
      normalizedFrom: normalizedFrom.status,
      normalizedTo: normalizedTo.status,
      message: dependencyFailure.message,
      details: dependencyFailure.details,
    });
  }

  return transitionSuccess({
    lifecycle: "invoice",
    from,
    to,
    normalizedFrom: normalizedFrom.status,
    normalizedTo: normalizedTo.status,
    message: `Invoice transition ${normalizedFrom.status} -> ${normalizedTo.status} is allowed.`,
    details: {
      fromSource: normalizedFrom.source,
      toSource: normalizedTo.source,
    },
  });
}

function validateWorkOrderReadinessDependency(
  from: InvoiceLifecycleStatus,
  to: InvoiceLifecycleStatus,
  context: InvoiceTransitionContext,
):
  | { readonly message: string; readonly details: Record<string, unknown> }
  | undefined {
  const requiresStrictCheck =
    from === INVOICE_STATUS.NotReady && to === INVOICE_STATUS.Ready;
  const shouldRecheck =
    !requiresStrictCheck &&
    context.workOrderStatus != null &&
    (workOrderReadinessCheckedInvoiceStatuses as readonly InvoiceLifecycleStatus[])
      .includes(to);

  if (!requiresStrictCheck && !shouldRecheck) {
    return undefined;
  }

  const workOrderStatus = normalizeWorkOrderStatusResult(context.workOrderStatus);
  if (
    workOrderStatus.ok &&
    workOrderStatus.status === WORK_ORDER_STATUS.ReadyForInvoicing
  ) {
    return undefined;
  }

  return {
    message: `Invoice transition to ${to} requires a work order ready for invoicing.`,
    details: {
      dependency: "work-order",
      requiredStatus: WORK_ORDER_STATUS.ReadyForInvoicing,
      actualStatus: workOrderStatus.ok ? workOrderStatus.status : null,
      originalStatus: workOrderStatus.original,
      dependencyFailureCode: workOrderStatus.ok
        ? undefined
        : workOrderStatus.failureCode,
    },
  };
}
