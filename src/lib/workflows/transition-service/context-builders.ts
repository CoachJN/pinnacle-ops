import type { Invoice } from "@/types/financial";
import type { WorkOrder } from "@/types/work-order";
import {
  QUOTE_STATUS,
  WORK_ORDER_STATUS,
  type InvoiceLifecycleStatus,
  type WorkOrderLifecycleStatus,
} from "../lifecycle/index.ts";
import type {
  InvoiceTransitionContext,
  WorkOrderTransitionContext,
} from "../transition-engine/index.ts";
import type { InvoiceTransitionRepository } from "./repositories.ts";

type ContextBuildResult<TContext> =
  | { readonly ok: true; readonly context: TContext }
  | {
      readonly ok: false;
      readonly message: string;
      readonly details?: Readonly<Record<string, unknown>>;
    };

type RuntimeWorkOrderWithQuoteState = WorkOrder & {
  readonly quoteRequired?: boolean;
  readonly requiresQuote?: boolean;
  readonly quoteStatus?: string | null;
  readonly clientQuoteStatus?: string | null;
};

const quoteApprovalGatedTargets = [
  WORK_ORDER_STATUS.ApprovedToProceed,
  WORK_ORDER_STATUS.Scheduling,
  WORK_ORDER_STATUS.Scheduled,
  WORK_ORDER_STATUS.InProgress,
] as const satisfies readonly WorkOrderLifecycleStatus[];

const quotePathStatuses = [
  WORK_ORDER_STATUS.QuotingRequired,
  WORK_ORDER_STATUS.AwaitingQuote,
  WORK_ORDER_STATUS.QuoteReceived,
  WORK_ORDER_STATUS.QuoteReview,
  WORK_ORDER_STATUS.AwaitingClientApproval,
] as const satisfies readonly WorkOrderLifecycleStatus[];

export function buildWorkOrderTransitionContext(input: {
  readonly workOrder: WorkOrder;
  readonly from: WorkOrderLifecycleStatus;
  readonly to: WorkOrderLifecycleStatus;
  readonly contextOverrides?: Partial<WorkOrderTransitionContext>;
}): ContextBuildResult<WorkOrderTransitionContext> {
  const runtimeWorkOrder = input.workOrder as RuntimeWorkOrderWithQuoteState;
  const explicitQuoteRequired = getQuoteRequired(runtimeWorkOrder);
  const quoteStatus = runtimeWorkOrder.quoteStatus ?? runtimeWorkOrder.clientQuoteStatus;
  const transitionMayRequireQuote =
    (quoteApprovalGatedTargets as readonly WorkOrderLifecycleStatus[]).includes(
      input.to,
    ) ||
    (quotePathStatuses as readonly WorkOrderLifecycleStatus[]).includes(input.from);

  if (explicitQuoteRequired == null && transitionMayRequireQuote) {
    return {
      ok: false,
      message:
        "Cannot determine whether a quote is required for this work order transition.",
      details: {
        dependency: "quote",
        requiredContext: "quoteRequired",
        workOrderId: input.workOrder.id,
      },
    };
  }

  const quoteRequired = explicitQuoteRequired ?? quoteStatus != null;
  if (
    quoteRequired &&
    (quoteApprovalGatedTargets as readonly WorkOrderLifecycleStatus[]).includes(
      input.to,
    ) &&
    !quoteStatus
  ) {
    return {
      ok: false,
      message:
        "Cannot determine quote approval state for this work order transition.",
      details: {
        dependency: "quote",
        requiredStatus: QUOTE_STATUS.ClientApproved,
        requiredContext: "quoteStatus",
        workOrderId: input.workOrder.id,
      },
    };
  }

  return {
    ok: true,
    context: {
      ...input.contextOverrides,
      quoteRequired,
      quoteStatus,
    },
  };
}

export async function buildInvoiceTransitionContext(input: {
  readonly invoice: Invoice;
  readonly from: InvoiceLifecycleStatus;
  readonly to: InvoiceLifecycleStatus;
  readonly repositories: Pick<InvoiceTransitionRepository, "getWorkOrderById">;
  readonly contextOverrides?: Partial<InvoiceTransitionContext>;
}): Promise<ContextBuildResult<InvoiceTransitionContext>> {
  if (!input.invoice.workOrderId) {
    return {
      ok: false,
      message: "Invoice transition requires a related work order.",
      details: { dependency: "work-order", invoiceId: input.invoice.id },
    };
  }

  const workOrder = await input.repositories.getWorkOrderById(input.invoice.workOrderId);
  if (!workOrder) {
    return {
      ok: false,
      message: "Related work order could not be resolved for invoice transition.",
      details: {
        dependency: "work-order",
        invoiceId: input.invoice.id,
        workOrderId: input.invoice.workOrderId,
      },
    };
  }

  return {
    ok: true,
    context: {
      ...input.contextOverrides,
      workOrderStatus: workOrder.status,
    },
  };
}

function getQuoteRequired(
  workOrder: RuntimeWorkOrderWithQuoteState,
): boolean | undefined {
  if (typeof workOrder.quoteRequired === "boolean") {
    return workOrder.quoteRequired;
  }

  if (typeof workOrder.requiresQuote === "boolean") {
    return workOrder.requiresQuote;
  }

  return undefined;
}
