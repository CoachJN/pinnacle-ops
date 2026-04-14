import {
  QUOTE_STATUS,
  WORK_ORDER_STATUS,
  type WorkOrderLifecycleStatus,
} from "../lifecycle/index.ts";
import { authorizeLifecycleTransition } from "../rbac-transition/index.ts";
import {
  normalizeQuoteStatusResult,
  normalizeWorkOrderStatusResult,
} from "../transition-engine/adapters.ts";
import type { WorkOrderTransitionContext } from "../transition-engine/index.ts";
import {
  buildBlockedMessage,
  mapAuthorizationBlockReason,
} from "./helpers.ts";
import type {
  WorkOrderActionAvailabilityInput,
  WorkOrderActionAvailabilityResult,
  WorkOrderActionCatalogEntry,
  WorkOrderActionDescriptor,
  WorkOrderRuntimeState,
} from "./types.ts";

export const WORK_ORDER_ACTION_CATALOG = [
  action("move_to_triage", WORK_ORDER_STATUS.Triage, "Move to triage"),
  action("request_quote", WORK_ORDER_STATUS.QuotingRequired, "Request quote"),
  action("mark_quote_received", WORK_ORDER_STATUS.QuoteReceived, "Mark quote received"),
  action(
    "send_for_client_approval",
    WORK_ORDER_STATUS.AwaitingClientApproval,
    "Send for client approval",
  ),
  action(
    "approve_to_proceed",
    WORK_ORDER_STATUS.ApprovedToProceed,
    "Approve to proceed",
  ),
  action(
    "move_to_scheduling",
    WORK_ORDER_STATUS.Scheduling,
    "Move to scheduling",
  ),
  action("mark_scheduled", WORK_ORDER_STATUS.Scheduled, "Mark scheduled"),
  action("start_work", WORK_ORDER_STATUS.InProgress, "Start work"),
  action(
    "mark_work_completed",
    WORK_ORDER_STATUS.WorkCompleted,
    "Mark work completed",
  ),
  action("send_to_qa", WORK_ORDER_STATUS.QaReview, "Send to QA"),
  action(
    "ready_for_invoicing",
    WORK_ORDER_STATUS.ReadyForInvoicing,
    "Ready for invoicing",
  ),
  action(
    "complete_work_order",
    WORK_ORDER_STATUS.Completed,
    "Complete work order",
  ),
  action("place_on_hold", WORK_ORDER_STATUS.OnHold, "Place on hold"),
  action("escalate_work_order", WORK_ORDER_STATUS.Escalated, "Escalate work order"),
  action("cancel_work_order", WORK_ORDER_STATUS.Cancelled, "Cancel work order"),
] as const satisfies readonly WorkOrderActionCatalogEntry[];

const quoteApprovalGatedTargets = [
  WORK_ORDER_STATUS.ApprovedToProceed,
  WORK_ORDER_STATUS.Scheduling,
  WORK_ORDER_STATUS.Scheduled,
  WORK_ORDER_STATUS.InProgress,
] as const satisfies readonly WorkOrderLifecycleStatus[];

export async function getAvailableWorkOrderActions(
  input: WorkOrderActionAvailabilityInput,
): Promise<WorkOrderActionAvailabilityResult> {
  const workOrder = await resolveWorkOrder(input);
  const entityId = input.entityId ?? workOrder?.id;

  if (!workOrder) {
    return {
      ok: false,
      supported: true,
      lifecycle: "work-order",
      entityType: "work-order",
      entityId,
      actions: [],
      blockReasonCode: "ENTITY_NOT_FOUND",
      message: "Work order could not be resolved for action availability.",
    };
  }

  const fromStatus = normalizeWorkOrderStatusResult(workOrder.status);
  if (!fromStatus.ok) {
    return {
      ok: false,
      supported: true,
      lifecycle: "work-order",
      entityType: "work-order",
      entityId: workOrder.id,
      currentStatus: workOrder.status,
      actions: WORK_ORDER_ACTION_CATALOG.map((entry) =>
        blockedWorkOrderAction(entry, {
          input,
          fromStatus: null,
          blockReasonCode: fromStatus.failureCode,
          message: fromStatus.message,
          details: { field: "status", original: fromStatus.original },
        }),
      ),
      blockReasonCode: fromStatus.failureCode,
      message: fromStatus.message,
    };
  }

  const actions = WORK_ORDER_ACTION_CATALOG.map((entry) =>
    evaluateWorkOrderAction({
      entry,
      input,
      workOrder,
      fromStatus: fromStatus.status,
    }),
  );

  return {
    ok: true,
    supported: true,
    lifecycle: "work-order",
    entityType: "work-order",
    entityId: workOrder.id,
    currentStatus: fromStatus.status,
    actions,
    message: "Work order action availability evaluated.",
  };
}

function evaluateWorkOrderAction(input: {
  readonly entry: WorkOrderActionCatalogEntry;
  readonly input: WorkOrderActionAvailabilityInput;
  readonly workOrder: WorkOrderRuntimeState;
  readonly fromStatus: WorkOrderLifecycleStatus;
}): WorkOrderActionDescriptor {
  const context = buildWorkOrderActionContext(input.workOrder, input.input);
  const authorization = authorizeLifecycleTransition({
    lifecycle: "work-order",
    from: input.fromStatus,
    to: input.entry.toStatus,
    actorType: input.input.actorType,
    role: input.input.role,
    context,
  });

  if (authorization.ok) {
    return {
      actionCode: input.entry.actionCode,
      lifecycle: "work-order",
      entityType: "work-order",
      fromStatus: input.fromStatus,
      toStatus: input.entry.toStatus,
      label: input.entry.label,
      actorType: authorization.actorType,
      role: authorization.role ?? null,
      allowed: true,
      blockReasonCode: null,
      message: authorization.message,
      details: authorization.details,
    };
  }

  const blockReasonCode = mapAuthorizationBlockReason(authorization);
  const lifecycleDetails = authorization.details?.lifecycleDetails as
    | Record<string, unknown>
    | undefined;
  const quoteDependencyBlock = getQuoteDependencyBlock(
    input.entry.toStatus,
    context,
  );
  const resolvedBlockReasonCode = quoteDependencyBlock
    ? "DEPENDENCY_FAILED"
    : blockReasonCode;
  const details = quoteDependencyBlock
    ? {
        ...authorization.details,
        lifecycleDetails: quoteDependencyBlock,
      }
    : authorization.details;

  return {
    actionCode: input.entry.actionCode,
    lifecycle: "work-order",
    entityType: "work-order",
    fromStatus: input.fromStatus,
    toStatus: input.entry.toStatus,
    label: input.entry.label,
    actorType: input.input.actorType,
    role: input.input.role ?? null,
    allowed: false,
    blockReasonCode: resolvedBlockReasonCode,
    message: buildBlockedMessage({
      defaultMessage: authorization.message,
      blockReasonCode: resolvedBlockReasonCode,
      details: quoteDependencyBlock ?? lifecycleDetails,
    }),
    details,
  };
}

function buildWorkOrderActionContext(
  workOrder: WorkOrderRuntimeState,
  input: WorkOrderActionAvailabilityInput,
): WorkOrderTransitionContext {
  const quoteRequired =
    input.contextOverrides?.quoteRequired ??
    workOrder.quoteRequired ??
    workOrder.requiresQuote ??
    (workOrder.quoteStatus != null || workOrder.clientQuoteStatus != null);

  return {
    quoteRequired,
    quoteStatus:
      input.contextOverrides?.quoteStatus ??
      workOrder.quoteStatus ??
      workOrder.clientQuoteStatus ??
      (workOrder.quoteRequired || workOrder.requiresQuote ? null : QUOTE_STATUS.ClientApproved),
  };
}

function blockedWorkOrderAction(
  entry: WorkOrderActionCatalogEntry,
  input: {
    readonly input: WorkOrderActionAvailabilityInput;
    readonly fromStatus: WorkOrderLifecycleStatus | null;
    readonly blockReasonCode: "UNKNOWN_STATUS" | "STATUS_MODEL_MISMATCH";
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  },
): WorkOrderActionDescriptor {
  return {
    actionCode: entry.actionCode,
    lifecycle: "work-order",
    entityType: "work-order",
    fromStatus: input.fromStatus,
    toStatus: entry.toStatus,
    label: entry.label,
    actorType: input.input.actorType,
    role: input.input.role ?? null,
    allowed: false,
    blockReasonCode: input.blockReasonCode,
    message: input.message,
    details: input.details,
  };
}

function getQuoteDependencyBlock(
  toStatus: WorkOrderLifecycleStatus,
  context: WorkOrderTransitionContext,
): Record<string, unknown> | null {
  if (
    !context.quoteRequired ||
    !(quoteApprovalGatedTargets as readonly WorkOrderLifecycleStatus[]).includes(
      toStatus,
    )
  ) {
    return null;
  }

  const quoteStatus = normalizeQuoteStatusResult(context.quoteStatus);
  if (quoteStatus.ok && quoteStatus.status === QUOTE_STATUS.ClientApproved) {
    return null;
  }

  return {
    dependency: "quote",
    requiredStatus: QUOTE_STATUS.ClientApproved,
    actualStatus: quoteStatus.ok ? quoteStatus.status : null,
    originalStatus: quoteStatus.original,
    dependencyFailureCode: quoteStatus.ok ? undefined : quoteStatus.failureCode,
  };
}

async function resolveWorkOrder(
  input: WorkOrderActionAvailabilityInput,
): Promise<WorkOrderRuntimeState | null> {
  if (input.entity) {
    return input.entity as WorkOrderRuntimeState;
  }

  if (!input.entityId || !input.repositories?.getWorkOrderById) {
    return null;
  }

  return (await input.repositories.getWorkOrderById(input.entityId)) as
    | WorkOrderRuntimeState
    | null;
}

function action(
  actionCode: WorkOrderActionCatalogEntry["actionCode"],
  toStatus: WorkOrderActionCatalogEntry["toStatus"],
  label: string,
): WorkOrderActionCatalogEntry {
  return {
    actionCode,
    lifecycle: "work-order",
    entityType: "work-order",
    toStatus,
    label,
  };
}
