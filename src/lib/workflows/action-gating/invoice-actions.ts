import type { WorkOrder } from "@/types/work-order";
import {
  INVOICE_STATUS,
  type InvoiceLifecycleStatus,
} from "../lifecycle/index.ts";
import { authorizeLifecycleTransition } from "../rbac-transition/index.ts";
import { normalizeInvoiceStatusResult } from "../transition-engine/adapters.ts";
import type { InvoiceTransitionContext } from "../transition-engine/index.ts";
import {
  buildBlockedMessage,
  mapAuthorizationBlockReason,
} from "./helpers.ts";
import type {
  InvoiceActionAvailabilityInput,
  InvoiceActionAvailabilityResult,
  InvoiceActionCatalogEntry,
  InvoiceActionDescriptor,
  InvoiceRuntimeState,
} from "./types.ts";

export const INVOICE_ACTION_CATALOG = [
  action("mark_ready", INVOICE_STATUS.Ready, "Mark ready"),
  action("draft_invoice", INVOICE_STATUS.Draft, "Draft invoice"),
  action("send_invoice", INVOICE_STATUS.Sent, "Send invoice"),
  action("mark_partially_paid", INVOICE_STATUS.PartiallyPaid, "Mark partially paid"),
  action("mark_paid", INVOICE_STATUS.Paid, "Mark paid"),
  action("void_invoice", INVOICE_STATUS.Voided, "Void invoice"),
  action("mark_viewed", INVOICE_STATUS.Viewed, "Mark viewed"),
  action("mark_overdue", INVOICE_STATUS.Overdue, "Mark overdue"),
] as const satisfies readonly InvoiceActionCatalogEntry[];

export async function getAvailableInvoiceActions(
  input: InvoiceActionAvailabilityInput,
): Promise<InvoiceActionAvailabilityResult> {
  const invoice = await resolveInvoice(input);
  const entityId = input.entityId ?? invoice?.id;

  if (!invoice) {
    return {
      ok: false,
      supported: true,
      lifecycle: "invoice",
      entityType: "invoice",
      entityId,
      actions: [],
      blockReasonCode: "ENTITY_NOT_FOUND",
      message: "Invoice could not be resolved for action availability.",
    };
  }

  const fromStatus = normalizeInvoiceStatusResult(invoice.status);
  if (!fromStatus.ok) {
    return {
      ok: false,
      supported: true,
      lifecycle: "invoice",
      entityType: "invoice",
      entityId: invoice.id,
      currentStatus: invoice.status,
      actions: INVOICE_ACTION_CATALOG.map((entry) =>
        blockedInvoiceAction(entry, {
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

  const workOrder = await resolveRelatedWorkOrder(invoice, input);
  const actions = INVOICE_ACTION_CATALOG.map((entry) =>
    evaluateInvoiceAction({
      entry,
      input,
      invoice,
      fromStatus: fromStatus.status,
      workOrder,
    }),
  );

  return {
    ok: true,
    supported: true,
    lifecycle: "invoice",
    entityType: "invoice",
    entityId: invoice.id,
    currentStatus: fromStatus.status,
    actions,
    message: "Invoice action availability evaluated.",
  };
}

function evaluateInvoiceAction(input: {
  readonly entry: InvoiceActionCatalogEntry;
  readonly input: InvoiceActionAvailabilityInput;
  readonly invoice: InvoiceRuntimeState;
  readonly fromStatus: InvoiceLifecycleStatus;
  readonly workOrder: WorkOrder | null;
}): InvoiceActionDescriptor {
  const context = buildInvoiceActionContext(input.workOrder, input.input);
  const authorization = authorizeLifecycleTransition({
    lifecycle: "invoice",
    from: input.fromStatus,
    to: input.entry.toStatus,
    actorType: input.input.actorType,
    role: input.input.role,
    context,
  });

  if (authorization.ok) {
    return {
      actionCode: input.entry.actionCode,
      lifecycle: "invoice",
      entityType: "invoice",
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

  return {
    actionCode: input.entry.actionCode,
    lifecycle: "invoice",
    entityType: "invoice",
    fromStatus: input.fromStatus,
    toStatus: input.entry.toStatus,
    label: input.entry.label,
    actorType: input.input.actorType,
    role: input.input.role ?? null,
    allowed: false,
    blockReasonCode,
    message: buildBlockedMessage({
      defaultMessage: authorization.message,
      blockReasonCode,
      details: lifecycleDetails,
    }),
    details: authorization.details,
  };
}

function buildInvoiceActionContext(
  workOrder: WorkOrder | null,
  input: InvoiceActionAvailabilityInput,
): InvoiceTransitionContext {
  return {
    workOrderStatus: input.contextOverrides?.workOrderStatus ?? workOrder?.status,
  };
}

function blockedInvoiceAction(
  entry: InvoiceActionCatalogEntry,
  input: {
    readonly input: InvoiceActionAvailabilityInput;
    readonly fromStatus: InvoiceLifecycleStatus | null;
    readonly blockReasonCode: "UNKNOWN_STATUS" | "STATUS_MODEL_MISMATCH";
    readonly message: string;
    readonly details?: Readonly<Record<string, unknown>>;
  },
): InvoiceActionDescriptor {
  return {
    actionCode: entry.actionCode,
    lifecycle: "invoice",
    entityType: "invoice",
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

async function resolveInvoice(
  input: InvoiceActionAvailabilityInput,
): Promise<InvoiceRuntimeState | null> {
  if (input.entity) {
    return input.entity;
  }

  if (!input.entityId || !input.repositories?.getInvoiceById) {
    return null;
  }

  return await input.repositories.getInvoiceById(input.entityId);
}

async function resolveRelatedWorkOrder(
  invoice: InvoiceRuntimeState,
  input: InvoiceActionAvailabilityInput,
): Promise<WorkOrder | null> {
  if (!invoice.workOrderId || !input.repositories?.getWorkOrderById) {
    return null;
  }

  return await input.repositories.getWorkOrderById(invoice.workOrderId);
}

function action(
  actionCode: InvoiceActionCatalogEntry["actionCode"],
  toStatus: InvoiceActionCatalogEntry["toStatus"],
  label: string,
): InvoiceActionCatalogEntry {
  return {
    actionCode,
    lifecycle: "invoice",
    entityType: "invoice",
    toStatus,
    label,
  };
}
