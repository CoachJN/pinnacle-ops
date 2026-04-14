import {
  INVOICE_STATUS,
  QUOTE_STATUS,
  WORK_ORDER_STATUS,
} from "../lifecycle/index.ts";
import type { TransitionEventRecord } from "../audit/index.ts";
import type { AutomationIntent, AutomationIntentType } from "./types.ts";

type AutomationMapping = Readonly<{
  newStatus: string;
  type: AutomationIntentType;
  actionKey: string;
  automationKey: string;
  message: string;
}>;

const WORK_ORDER_AUTOMATION_MAPPINGS = [
  {
    newStatus: WORK_ORDER_STATUS.AwaitingQuote,
    type: "CREATE_INTERNAL_FOLLOW_UP",
    actionKey: "create-internal-quote-follow-up",
    automationKey: "work-order.awaiting-quote.follow-up",
    message: "Create an internal follow-up for the outstanding quote.",
  },
  {
    newStatus: WORK_ORDER_STATUS.AwaitingClientApproval,
    type: "REQUEST_MANAGER_REVIEW",
    actionKey: "request-manager-quote-review",
    automationKey: "work-order.awaiting-client-approval.manager-review",
    message: "Request manager review while client approval is active.",
  },
  {
    newStatus: WORK_ORDER_STATUS.ApprovedToProceed,
    type: "FLAG_WORK_ORDER_FOR_SCHEDULING",
    actionKey: "flag-work-order-for-scheduling",
    automationKey: "work-order.approved-to-proceed.schedule",
    message: "Flag the work order for scheduling.",
  },
  {
    newStatus: WORK_ORDER_STATUS.ReadyForInvoicing,
    type: "FLAG_WORK_ORDER_FOR_INVOICING",
    actionKey: "flag-work-order-for-invoicing",
    automationKey: "work-order.ready-for-invoicing.invoice",
    message: "Flag the work order for invoicing.",
  },
] as const satisfies readonly AutomationMapping[];

const INVOICE_AUTOMATION_MAPPINGS = [
  {
    newStatus: INVOICE_STATUS.Overdue,
    type: "FLAG_INVOICE_FOR_COLLECTION_REVIEW",
    actionKey: "flag-invoice-for-collection-review",
    automationKey: "invoice.overdue.collection-review",
    message: "Flag the invoice for collection review.",
  },
] as const satisfies readonly AutomationMapping[];

// Future-ready quote mappings. Runtime quote transition application is still
// deferred, so these are not dispatched by handleTransitionEvent yet.
export const QUOTE_AUTOMATION_MAPPINGS = [
  {
    newStatus: QUOTE_STATUS.SentToClient,
    type: "REQUEST_MANAGER_REVIEW",
    actionKey: "request-manager-client-quote-review",
    automationKey: "quote.sent-to-client.manager-review",
    message: "Request manager review while the client quote decision is active.",
  },
] as const satisfies readonly AutomationMapping[];

export function buildAutomationIntents(
  event: TransitionEventRecord,
): readonly AutomationIntent[] {
  if (event.lifecycle === "work-order") {
    return buildMappedAutomationIntents(event, WORK_ORDER_AUTOMATION_MAPPINGS);
  }

  if (event.lifecycle === "invoice") {
    return buildMappedAutomationIntents(event, INVOICE_AUTOMATION_MAPPINGS);
  }

  return [];
}

function buildMappedAutomationIntents(
  event: TransitionEventRecord,
  mappings: readonly AutomationMapping[],
): readonly AutomationIntent[] {
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
      actionKey: mapping.actionKey,
      automationKey: mapping.automationKey,
      message: mapping.message,
      metadata: event.metadata,
    }));
}

