import {
  INVOICE_STATUS,
  QUOTE_STATUS,
  WORK_ORDER_STATUS,
} from "../lifecycle/index.ts";
import { PLATFORM_ROLES } from "../rbac-transition/index.ts";
import type { TransitionEventRecord } from "../audit/index.ts";
import type { NotificationIntent, NotificationIntentType } from "./types.ts";

type NotificationMapping = Readonly<{
  newStatus: string;
  type: NotificationIntentType;
  message: string;
  targetAudience: NotificationIntent["targetAudience"];
  recipientRoles?: NotificationIntent["recipientRoles"];
}>;

const WORK_ORDER_NOTIFICATION_MAPPINGS = [
  {
    newStatus: WORK_ORDER_STATUS.AwaitingQuote,
    type: "INTERNAL_STATUS_ALERT",
    message: "Work order is awaiting a contractor quote.",
    targetAudience: {
      type: "role",
      roles: [PLATFORM_ROLES.Coordinator, PLATFORM_ROLES.Manager],
    },
    recipientRoles: [PLATFORM_ROLES.Coordinator, PLATFORM_ROLES.Manager],
  },
  {
    newStatus: WORK_ORDER_STATUS.AwaitingClientApproval,
    type: "CLIENT_QUOTE_DECISION_REQUEST",
    message: "Client quote approval is ready for decision.",
    targetAudience: { type: "client-contact" },
    recipientRoles: [PLATFORM_ROLES.ClientUser],
  },
  {
    newStatus: WORK_ORDER_STATUS.ApprovedToProceed,
    type: "COORDINATOR_WORK_READY_ALERT",
    message: "Work order is approved to proceed and ready for coordination.",
    targetAudience: { type: "coordinator-assigned" },
    recipientRoles: [PLATFORM_ROLES.Coordinator],
  },
  {
    newStatus: WORK_ORDER_STATUS.ReadyForInvoicing,
    type: "FINANCE_WORK_READY_FOR_INVOICING_ALERT",
    message: "Work order is ready for invoicing.",
    targetAudience: { type: "finance" },
    recipientRoles: [PLATFORM_ROLES.FinanceAdmin],
  },
] as const satisfies readonly NotificationMapping[];

const INVOICE_NOTIFICATION_MAPPINGS = [
  {
    newStatus: INVOICE_STATUS.Sent,
    type: "INVOICE_SENT_ALERT",
    message: "Invoice has been sent.",
    targetAudience: { type: "client-contact" },
    recipientRoles: [PLATFORM_ROLES.ClientUser],
  },
  {
    newStatus: INVOICE_STATUS.Overdue,
    type: "INVOICE_OVERDUE_ALERT",
    message: "Invoice is overdue and needs collection review.",
    targetAudience: { type: "finance" },
    recipientRoles: [PLATFORM_ROLES.FinanceAdmin],
  },
] as const satisfies readonly NotificationMapping[];

// Future-ready quote mappings. Runtime quote transition application is still
// deferred, so these are not dispatched by handleTransitionEvent yet.
export const QUOTE_NOTIFICATION_MAPPINGS = [
  {
    newStatus: QUOTE_STATUS.SentToClient,
    type: "CLIENT_QUOTE_DECISION_REQUEST",
    message: "Client quote approval is ready for decision.",
    targetAudience: { type: "client-contact" },
    recipientRoles: [PLATFORM_ROLES.ClientUser],
  },
  {
    newStatus: QUOTE_STATUS.ClientApproved,
    type: "CLIENT_QUOTE_APPROVED_CONFIRMATION",
    message: "Client quote has been approved.",
    targetAudience: {
      type: "role",
      roles: [PLATFORM_ROLES.Coordinator, PLATFORM_ROLES.Manager],
    },
    recipientRoles: [PLATFORM_ROLES.Coordinator, PLATFORM_ROLES.Manager],
  },
] as const satisfies readonly NotificationMapping[];

export function buildNotificationIntents(
  event: TransitionEventRecord,
): readonly NotificationIntent[] {
  if (event.lifecycle === "work-order") {
    return buildMappedNotificationIntents(event, WORK_ORDER_NOTIFICATION_MAPPINGS);
  }

  if (event.lifecycle === "invoice") {
    return buildMappedNotificationIntents(event, INVOICE_NOTIFICATION_MAPPINGS);
  }

  return [];
}

function buildMappedNotificationIntents(
  event: TransitionEventRecord,
  mappings: readonly NotificationMapping[],
): readonly NotificationIntent[] {
  return mappings
    .filter((mapping) => mapping.newStatus === event.newStatus)
    .map((mapping) => ({
      type: mapping.type,
      lifecycle: event.lifecycle,
      entityType: event.entityType,
      entityId: event.entityId,
      eventType: event.eventType,
      previousStatus: event.previousStatus,
      newStatus: event.newStatus,
      actorType: event.actorType,
      role: event.role,
      actorUserId: event.actorUserId,
      targetAudience: mapping.targetAudience,
      recipientRoles: mapping.recipientRoles,
      message: mapping.message,
      metadata: event.metadata,
    }));
}

