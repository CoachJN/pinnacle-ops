import {
  INTERNAL_NOTIFICATION_EVENT_TYPES,
  INTERNAL_NOTIFICATION_SEVERITIES,
  type InternalNotificationDefinition,
  type InternalNotificationEventType,
} from "./types.ts";

export const INTERNAL_NOTIFICATION_EVENT_MAP: Readonly<Record<
  InternalNotificationEventType,
  InternalNotificationDefinition
>> = {
  [INTERNAL_NOTIFICATION_EVENT_TYPES.ContractorAssigned]: {
    eventType: INTERNAL_NOTIFICATION_EVENT_TYPES.ContractorAssigned,
    title: "Contractor assigned",
    severity: INTERNAL_NOTIFICATION_SEVERITIES.Normal,
    defaultDueHours: 24,
  },
  [INTERNAL_NOTIFICATION_EVENT_TYPES.ContractorAccepted]: {
    eventType: INTERNAL_NOTIFICATION_EVENT_TYPES.ContractorAccepted,
    title: "Contractor accepted assignment",
    severity: INTERNAL_NOTIFICATION_SEVERITIES.Normal,
    defaultDueHours: null,
  },
  [INTERNAL_NOTIFICATION_EVENT_TYPES.ContractorDeclined]: {
    eventType: INTERNAL_NOTIFICATION_EVENT_TYPES.ContractorDeclined,
    title: "Contractor declined assignment",
    severity: INTERNAL_NOTIFICATION_SEVERITIES.High,
    defaultDueHours: 4,
  },
  [INTERNAL_NOTIFICATION_EVENT_TYPES.ContractorCompletedAssignment]: {
    eventType: INTERNAL_NOTIFICATION_EVENT_TYPES.ContractorCompletedAssignment,
    title: "Contractor completed assignment",
    severity: INTERNAL_NOTIFICATION_SEVERITIES.Normal,
    defaultDueHours: 24,
  },
  [INTERNAL_NOTIFICATION_EVENT_TYPES.QuoteSubmitted]: {
    eventType: INTERNAL_NOTIFICATION_EVENT_TYPES.QuoteSubmitted,
    title: "Quote submitted",
    severity: INTERNAL_NOTIFICATION_SEVERITIES.High,
    defaultDueHours: 24,
  },
  [INTERNAL_NOTIFICATION_EVENT_TYPES.QuoteAwaitingManagerReview]: {
    eventType: INTERNAL_NOTIFICATION_EVENT_TYPES.QuoteAwaitingManagerReview,
    title: "Quote awaiting manager review",
    severity: INTERNAL_NOTIFICATION_SEVERITIES.High,
    defaultDueHours: 24,
  },
  [INTERNAL_NOTIFICATION_EVENT_TYPES.QuoteAwaitingClientAction]: {
    eventType: INTERNAL_NOTIFICATION_EVENT_TYPES.QuoteAwaitingClientAction,
    title: "Quote awaiting client action",
    severity: INTERNAL_NOTIFICATION_SEVERITIES.Normal,
    defaultDueHours: 72,
  },
  [INTERNAL_NOTIFICATION_EVENT_TYPES.WorkOrderStalled]: {
    eventType: INTERNAL_NOTIFICATION_EVENT_TYPES.WorkOrderStalled,
    title: "Work order stalled",
    severity: INTERNAL_NOTIFICATION_SEVERITIES.High,
    defaultDueHours: null,
  },
  [INTERNAL_NOTIFICATION_EVENT_TYPES.WorkOrderReadyForInvoicing]: {
    eventType: INTERNAL_NOTIFICATION_EVENT_TYPES.WorkOrderReadyForInvoicing,
    title: "Work order ready for invoicing",
    severity: INTERNAL_NOTIFICATION_SEVERITIES.High,
    defaultDueHours: 24,
  },
  [INTERNAL_NOTIFICATION_EVENT_TYPES.InvoiceCreated]: {
    eventType: INTERNAL_NOTIFICATION_EVENT_TYPES.InvoiceCreated,
    title: "Invoice created",
    severity: INTERNAL_NOTIFICATION_SEVERITIES.Normal,
    defaultDueHours: 24,
  },
  [INTERNAL_NOTIFICATION_EVENT_TYPES.InvoiceSent]: {
    eventType: INTERNAL_NOTIFICATION_EVENT_TYPES.InvoiceSent,
    title: "Invoice sent",
    severity: INTERNAL_NOTIFICATION_SEVERITIES.Normal,
    defaultDueHours: 168,
  },
  [INTERNAL_NOTIFICATION_EVENT_TYPES.InvoiceOverdue]: {
    eventType: INTERNAL_NOTIFICATION_EVENT_TYPES.InvoiceOverdue,
    title: "Invoice overdue",
    severity: INTERNAL_NOTIFICATION_SEVERITIES.Critical,
    defaultDueHours: 24,
  },
  [INTERNAL_NOTIFICATION_EVENT_TYPES.SlaBreachTriggered]: {
    eventType: INTERNAL_NOTIFICATION_EVENT_TYPES.SlaBreachTriggered,
    title: "SLA breach triggered",
    severity: INTERNAL_NOTIFICATION_SEVERITIES.Critical,
    defaultDueHours: null,
  },
};

export function getInternalNotificationDefinition(
  eventType: InternalNotificationEventType,
): InternalNotificationDefinition {
  return INTERNAL_NOTIFICATION_EVENT_MAP[eventType];
}
