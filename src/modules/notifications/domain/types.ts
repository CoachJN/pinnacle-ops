import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { InternalUserRole, UserRole } from "@/types/permissions";

export const INTERNAL_NOTIFICATION_EVENT_TYPES = {
  ContractorAssigned: "contractor_assigned",
  ContractorAccepted: "contractor_accepted",
  ContractorDeclined: "contractor_declined",
  ContractorCompletedAssignment: "contractor_completed_assignment",
  QuoteSubmitted: "quote_submitted",
  QuoteAwaitingManagerReview: "quote_awaiting_manager_review",
  QuoteAwaitingClientAction: "quote_awaiting_client_action",
  WorkOrderStalled: "work_order_stalled",
  WorkOrderReadyForInvoicing: "work_order_ready_for_invoicing",
  InvoiceCreated: "invoice_created",
  InvoiceSent: "invoice_sent",
  InvoiceOverdue: "invoice_overdue",
  SlaBreachTriggered: "sla_breach_triggered",
} as const;

export type InternalNotificationEventType =
  (typeof INTERNAL_NOTIFICATION_EVENT_TYPES)[keyof typeof INTERNAL_NOTIFICATION_EVENT_TYPES];

export const INTERNAL_NOTIFICATION_SEVERITIES = {
  Low: "low",
  Normal: "normal",
  High: "high",
  Critical: "critical",
} as const;

export type InternalNotificationSeverity =
  (typeof INTERNAL_NOTIFICATION_SEVERITIES)[keyof typeof INTERNAL_NOTIFICATION_SEVERITIES];

export const INTERNAL_NOTIFICATION_STATUS = {
  Active: "active",
  Resolved: "resolved",
} as const;

export type InternalNotificationStatus =
  (typeof INTERNAL_NOTIFICATION_STATUS)[keyof typeof INTERNAL_NOTIFICATION_STATUS];

export const OPERATIONAL_ALERT_STATES = {
  Active: "active",
  AtRisk: "at_risk",
  Overdue: "overdue",
  SlaBreached: "sla_breached",
} as const;

export type OperationalAlertState =
  (typeof OPERATIONAL_ALERT_STATES)[keyof typeof OPERATIONAL_ALERT_STATES];

export interface NotificationActorSummary {
  readonly actorType: "user" | "system";
  readonly userId: EntityId | null;
  readonly role: UserRole | "system" | null;
  readonly displayName: string;
}

export interface NotificationRecipient {
  readonly userId: EntityId;
  readonly role: InternalUserRole;
  readonly displayName: string;
}

export interface NotificationRecipientContextUser {
  readonly id: EntityId;
  readonly role: UserRole;
  readonly displayName: string | null;
}

export interface NotificationEntityReference {
  readonly entityType: "work-order" | "invoice" | "quote" | "assignment";
  readonly entityId: EntityId;
  readonly workOrderId: EntityId | null;
  readonly invoiceId: EntityId | null;
  readonly quoteId: EntityId | null;
  readonly assignmentId: EntityId | null;
}

export interface NotificationMessageContext extends NotificationEntityReference {
  readonly workOrderNumber: string | null;
  readonly invoiceNumber: string | null;
  readonly quoteLabel: string | null;
  readonly assignmentLabel: string | null;
  readonly contractorName: string | null;
  readonly clientName: string | null;
  readonly locationName: string | null;
  readonly fromStatus: string | null;
  readonly toStatus: string | null;
}

export interface InternalNotificationDefinition {
  readonly eventType: InternalNotificationEventType;
  readonly title: string;
  readonly severity: InternalNotificationSeverity;
  readonly defaultDueHours: number | null;
}

export interface InternalNotificationRecord extends NotificationEntityReference {
  readonly id: EntityId;
  readonly organizationId: EntityId;
  readonly recipientUserId: EntityId;
  readonly recipientRole: InternalUserRole;
  readonly eventType: InternalNotificationEventType;
  readonly title: string;
  readonly message: string;
  readonly severity: InternalNotificationSeverity;
  readonly status: InternalNotificationStatus;
  readonly actor: NotificationActorSummary;
  readonly targetPath: string;
  readonly readAt: IsoDateTimeString | null;
  readonly acknowledgedAt: IsoDateTimeString | null;
  readonly resolvedAt: IsoDateTimeString | null;
  readonly dueAt: IsoDateTimeString | null;
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
  readonly metadata: Readonly<Record<string, unknown>> | null;
}
