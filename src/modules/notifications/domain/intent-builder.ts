import type { EntityId, IsoDateTimeString } from "@/types/entity";
import { getInternalNotificationDefinition } from "./event-map.ts";
import {
  INTERNAL_NOTIFICATION_STATUS,
  type InternalNotificationEventType,
  type InternalNotificationRecord,
  type NotificationActorSummary,
  type NotificationMessageContext,
  type NotificationRecipient,
} from "./types.ts";

interface BuildInternalNotificationsInput {
  readonly organizationId: EntityId;
  readonly eventType: InternalNotificationEventType;
  readonly recipients: readonly NotificationRecipient[];
  readonly actor: NotificationActorSummary;
  readonly context: NotificationMessageContext;
  readonly createdAt: IsoDateTimeString;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export function buildInternalNotificationRecords(
  input: BuildInternalNotificationsInput,
): readonly InternalNotificationRecord[] {
  const definition = getInternalNotificationDefinition(input.eventType);
  const dueAt =
    definition.defaultDueHours == null
      ? null
      : new Date(
          new Date(input.createdAt).getTime() +
            definition.defaultDueHours * 60 * 60 * 1000,
        ).toISOString();

  return input.recipients.map((recipient) => ({
    id: buildNotificationId({
      eventType: input.eventType,
      entityId: input.context.entityId,
      recipientUserId: recipient.userId,
      createdAt: input.createdAt,
    }),
    organizationId: input.organizationId,
    recipientUserId: recipient.userId,
    recipientRole: recipient.role,
    eventType: input.eventType,
    title: definition.title,
    message: buildNotificationMessage(input.eventType, input.context),
    severity: definition.severity,
    status: INTERNAL_NOTIFICATION_STATUS.Active,
    actor: input.actor,
    entityType: input.context.entityType,
    entityId: input.context.entityId,
    workOrderId: input.context.workOrderId,
    invoiceId: input.context.invoiceId,
    quoteId: input.context.quoteId,
    assignmentId: input.context.assignmentId,
    targetPath: buildTargetPath(input.context),
    readAt: null,
    acknowledgedAt: null,
    resolvedAt: null,
    dueAt,
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    metadata: input.metadata ?? null,
  }));
}

function buildNotificationId(input: {
  readonly eventType: InternalNotificationEventType;
  readonly entityId: EntityId;
  readonly recipientUserId: EntityId;
  readonly createdAt: IsoDateTimeString;
}): EntityId {
  return [
    "internal-notification",
    input.eventType,
    input.entityId,
    input.recipientUserId,
    input.createdAt,
  ]
    .join(":")
    .replaceAll(/\s+/g, "-");
}

function buildTargetPath(context: NotificationMessageContext): string {
  if (context.workOrderId) {
    return `/dashboard/work-orders/${context.workOrderId}`;
  }

  if (context.entityType === "invoice") {
    return "/finance";
  }

  return "/dashboard";
}

function buildNotificationMessage(
  eventType: InternalNotificationEventType,
  context: NotificationMessageContext,
): string {
  const workOrderLabel = context.workOrderNumber ?? context.workOrderId ?? "work order";
  const invoiceLabel = context.invoiceNumber ?? context.invoiceId ?? "invoice";
  const quoteLabel = context.quoteLabel ?? context.quoteId ?? "quote";
  const assignmentLabel = context.assignmentLabel ?? context.assignmentId ?? "assignment";
  const contractorName = context.contractorName ?? "the assigned contractor";

  switch (eventType) {
    case "contractor_assigned":
      return `${workOrderLabel} was assigned to ${contractorName}.`;
    case "contractor_accepted":
      return `${contractorName} accepted ${assignmentLabel} for ${workOrderLabel}.`;
    case "contractor_declined":
      return `${contractorName} declined ${assignmentLabel} for ${workOrderLabel}.`;
    case "contractor_completed_assignment":
      return `${contractorName} completed ${assignmentLabel} for ${workOrderLabel}.`;
    case "quote_submitted":
      return `${quoteLabel} was submitted for ${workOrderLabel}.`;
    case "quote_awaiting_manager_review":
      return `${quoteLabel} is waiting for manager review on ${workOrderLabel}.`;
    case "quote_awaiting_client_action":
      return `${quoteLabel} is waiting for client action on ${workOrderLabel}.`;
    case "work_order_ready_for_invoicing":
      return `${workOrderLabel} is ready for invoicing.`;
    case "invoice_created":
      return `${invoiceLabel} was created for ${workOrderLabel}.`;
    case "invoice_sent":
      return `${invoiceLabel} was sent for ${workOrderLabel}.`;
    case "invoice_overdue":
      return `${invoiceLabel} is overdue and needs finance follow-up.`;
    case "work_order_stalled":
      return `${workOrderLabel} is stalled and needs operational follow-up.`;
    case "sla_breach_triggered":
      return `${workOrderLabel} breached its follow-up window and needs action.`;
  }
}
