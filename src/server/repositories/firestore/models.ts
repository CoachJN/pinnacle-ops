import "server-only";

import type { Timestamp } from "firebase-admin/firestore";
import type { EntityId, IsoDateTimeString, RecordStatus } from "@/types/entity";
import type { ContractorStatus } from "@/modules/contractors";
import type {
  CommunicationAttachment,
  CommunicationActorReference,
  CommunicationChannel,
  CommunicationDirection,
  CommunicationLink,
  CommunicationMatchSuggestion,
  CommunicationMessage,
  CommunicationParticipant,
  CommunicationVisibility,
} from "@/modules/communications";
import type {
  ProviderConnection,
  ProviderMessageReceipt,
  ProviderSyncCheckpoint,
  ProviderSyncRun,
  ProviderThreadMapping,
} from "@/modules/providers";
import type {
  EventProcessingRecord,
  WorkerDeadLetterRecord,
  WorkerJob,
} from "@/modules/runtime";
import type { DeliveryPlan as CanonicalDeliveryPlan } from "@/modules/delivery";
import type { EscalationOrchestration } from "@/modules/escalation";
import type { DeliveryAttempt } from "@/modules/transport";
import type { SlaScanCursor, SlaTimer } from "@/modules/sla";
import type {
  AiIntakeDraft,
  IntakeApproval,
  IntakeArtifact,
  IntakeDecision,
  IntakeEvent,
} from "@/modules/intake";
import type {
  ContactRelationshipType,
  ContactStatus,
  PreferredContactMethod,
  PreferredLanguage,
} from "@/types/contact";
import type { UserRole } from "@/types/permissions";
import type {
  DomainEvent,
  EventActor,
  EventMetadata,
  EventVisibility,
} from "@/server/events/types";
import type {
  AssignmentStatus,
  WorkOrderApprovalStatus,
  WorkOrderInvoiceSummaryStatus,
  WorkOrderNextActionOwnerType,
  WorkOrderPriority,
  WorkOrderQuoteSummaryStatus,
  WorkOrderStatus,
} from "@/types/work-order";
import type {
  ClientQuoteStatus,
  ContractorQuoteStatus,
  QuoteLineItem,
} from "@/types/quote";
import type {
  ClientInvoice as CanonicalClientInvoice,
  InvoiceCurrency,
  InvoiceLineItem,
  InvoiceStatus,
  QboSyncStatus,
} from "@/types/invoice";

export type FirestoreRecordStatus = RecordStatus;
export type FirestoreOrganizationStatus = "active" | "inactive";
export type FirestoreContractorOrganizationStatus = ContractorStatus;
export type UserProfileStatus = "active" | "inactive" | "invited";

export interface FirestoreAuditFields {
  organizationId: EntityId;
  recordStatus: FirestoreRecordStatus;
  isDeleted: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdByUserId: EntityId;
  updatedByUserId: EntityId;
  deletedAt?: Timestamp | null;
  deletedByUserId?: EntityId | null;
}

export interface DomainAuditFields {
  organizationId: EntityId;
  recordStatus: FirestoreRecordStatus;
  isDeleted: boolean;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  createdByUserId: EntityId;
  updatedByUserId: EntityId;
  deletedAt?: IsoDateTimeString | null;
  deletedByUserId?: EntityId | null;
}

export interface EntitySnapshot {
  id: EntityId;
  name: string;
}

export interface UserProfile extends DomainAuditFields {
  id: EntityId;
  email: string;
  displayName: string | null;
  role: UserRole;
  status: UserProfileStatus;
  clientOrganizationId: EntityId | null;
  contractorOrganizationId: EntityId | null;
  locationIds: EntityId[];
  lastLoginAt: IsoDateTimeString | null;
}

export interface UserProfileDocument extends FirestoreAuditFields {
  email: string;
  displayName: string | null;
  role: UserRole;
  status: UserProfileStatus;
  clientOrganizationId: EntityId | null;
  contractorOrganizationId: EntityId | null;
  locationIds: EntityId[];
  lastLoginAt: Timestamp | null;
}

export interface Contact extends DomainAuditFields {
  id: EntityId;
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  primaryPhone: string | null;
  secondaryPhone: string | null;
  roleTitle: string | null;
  preferredLanguage: PreferredLanguage;
  preferredContactMethod: PreferredContactMethod | null;
  notes: string | null;
  status: ContactStatus;
}

export interface ContactDocument extends FirestoreAuditFields {
  firstName: string;
  lastName: string;
  displayName: string;
  email: string | null;
  primaryPhone: string | null;
  secondaryPhone: string | null;
  roleTitle: string | null;
  preferredLanguage: PreferredLanguage;
  preferredContactMethod: PreferredContactMethod | null;
  notes: string | null;
  status: ContactStatus;
}

export interface ClientOrganization extends DomainAuditFields {
  id: EntityId;
  name: string;
  displayName: string | null;
  status: FirestoreOrganizationStatus;
  primaryContactId?: EntityId | null;
  billingContactId?: EntityId | null;
  notes: string | null;
}

export interface ClientOrganizationDocument extends FirestoreAuditFields {
  name: string;
  displayName: string | null;
  status: FirestoreOrganizationStatus;
  primaryContactId?: EntityId | null;
  billingContactId?: EntityId | null;
  notes: string | null;
}

export interface Location extends DomainAuditFields {
  id: EntityId;
  clientOrganizationId: EntityId;
  name: string;
  displayName?: string | null;
  code: string | null;
  storeNumber?: string | null;
  status: FirestoreOrganizationStatus;
  primaryContactId?: EntityId | null;
  siteContactId?: EntityId | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timeZone?: string | null;
  accessNotes: string | null;
  serviceNotes?: string | null;
  notes: string | null;
}

export interface LocationDocument extends FirestoreAuditFields {
  clientOrganizationId: EntityId;
  name: string;
  displayName?: string | null;
  code: string | null;
  storeNumber?: string | null;
  status: FirestoreOrganizationStatus;
  primaryContactId?: EntityId | null;
  siteContactId?: EntityId | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timeZone?: string | null;
  accessNotes: string | null;
  serviceNotes?: string | null;
  notes: string | null;
}

export interface ContractorOrganization extends DomainAuditFields {
  id: EntityId;
  name: string;
  displayName: string | null;
  parentContractorId?: EntityId | null;
  status: FirestoreContractorOrganizationStatus;
  isAssignable?: boolean;
  primaryContactId?: EntityId | null;
  billingContactId?: EntityId | null;
  dispatchContactId?: EntityId | null;
  businessEmail?: string | null;
  mainPhone?: string | null;
  altPhone?: string | null;
  fax?: string | null;
  trades?: string[];
  serviceArea?: string | null;
  ratingSummary?:
    | {
        averageRating: number;
        reviewCount: number;
        lastReviewedAt?: IsoDateTimeString | null;
      }
    | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  notes: string | null;
}

export interface ContractorOrganizationDocument extends FirestoreAuditFields {
  name: string;
  displayName: string | null;
  parentContractorId?: EntityId | null;
  status: FirestoreContractorOrganizationStatus;
  isAssignable?: boolean;
  primaryContactId?: EntityId | null;
  billingContactId?: EntityId | null;
  dispatchContactId?: EntityId | null;
  businessEmail?: string | null;
  mainPhone?: string | null;
  altPhone?: string | null;
  fax?: string | null;
  trades?: string[];
  serviceArea?: string | null;
  ratingSummary?:
    | {
        averageRating: number;
        reviewCount: number;
        lastReviewedAt?: Timestamp | null;
      }
    | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  notes: string | null;
}

export interface ClientOrganizationContactLink extends DomainAuditFields {
  id: EntityId;
  clientOrganizationId: EntityId;
  contactId: EntityId;
  relationshipType: ContactRelationshipType;
  isPrimary: boolean;
  notes: string | null;
}

export interface ClientOrganizationContactLinkDocument extends FirestoreAuditFields {
  clientOrganizationId: EntityId;
  contactId: EntityId;
  relationshipType: ContactRelationshipType;
  isPrimary: boolean;
  notes: string | null;
}

export interface LocationContactLink extends DomainAuditFields {
  id: EntityId;
  locationId: EntityId;
  contactId: EntityId;
  relationshipType: ContactRelationshipType;
  isPrimary: boolean;
  notes: string | null;
}

export interface LocationContactLinkDocument extends FirestoreAuditFields {
  locationId: EntityId;
  contactId: EntityId;
  relationshipType: ContactRelationshipType;
  isPrimary: boolean;
  notes: string | null;
}

export interface ContractorContactLink extends DomainAuditFields {
  id: EntityId;
  contractorId: EntityId;
  contactId: EntityId;
  relationshipType: ContactRelationshipType;
  isPrimary: boolean;
  notes: string | null;
}

export interface ContractorContactLinkDocument extends FirestoreAuditFields {
  contractorId: EntityId;
  contactId: EntityId;
  relationshipType: ContactRelationshipType;
  isPrimary: boolean;
  notes: string | null;
}

export interface WorkOrder extends DomainAuditFields {
  id: EntityId;
  workOrderNumber: string;
  title: string;
  description: string;
  poNumber?: string | null;
  requestedByName?: string | null;
  requestedByEmail?: string | null;
  requestedByPhone?: string | null;
  requestedServiceDate?: IsoDateTimeString | null;
  dueDate?: IsoDateTimeString | null;
  category?: string | null;
  requiresQuote?: boolean;
  quoteRequiredThresholdCents?: number | null;
  lifecycleStatus: WorkOrderStatus;
  status: WorkOrderStatus;
  assignmentStatus?: AssignmentStatus | null;
  quoteSummaryStatus?: WorkOrderQuoteSummaryStatus | null;
  invoiceSummaryStatus?: WorkOrderInvoiceSummaryStatus | null;
  approvalStatus?: WorkOrderApprovalStatus | null;
  priority: WorkOrderPriority;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  requestedByContactId: EntityId | null;
  siteContactId?: EntityId | null;
  coordinatorUserId: EntityId | null;
  managerUserId: EntityId | null;
  assignedCoordinatorUserId?: EntityId | null;
  assignedManagerUserId?: EntityId | null;
  assignedContractorOrgId?: EntityId | null;
  assignedContractorId?: EntityId | null;
  assignedContractorContactId?: EntityId | null;
  financeOwnerUserId?: EntityId | null;
  quoteReviewerUserId?: EntityId | null;
  currentQuoteId: EntityId | null;
  currentInvoiceId: EntityId | null;
  currentQuoteVersionNumber?: number | null;
  invoiceNumber?: string | null;
  clientSnapshot: EntitySnapshot;
  locationSnapshot: EntitySnapshot & { addressText: string | null };
  contractorSnapshot: EntitySnapshot | null;
  lastActivityAt?: IsoDateTimeString | null;
  nextActionOwnerType?: WorkOrderNextActionOwnerType | null;
  nextActionDueAt?: IsoDateTimeString | null;
  isEscalated?: boolean;
  escalationReason?: string | null;
  holdReason?: string | null;
  previousLifecycleStatus?: WorkOrderStatus | null;
  intakeReceivedAt?: IsoDateTimeString | null;
  submittedAt?: IsoDateTimeString | null;
  triagedAt?: IsoDateTimeString | null;
  assignedAt?: IsoDateTimeString | null;
  contractorContactedAt?: IsoDateTimeString | null;
  contractorRespondedAt?: IsoDateTimeString | null;
  contractorScheduledAt?: IsoDateTimeString | null;
  workStartedAt?: IsoDateTimeString | null;
  quoteRequestedAt?: IsoDateTimeString | null;
  contractorQuoteReceivedAt?: IsoDateTimeString | null;
  quoteReviewStartedAt?: IsoDateTimeString | null;
  clientApprovalRequestedAt?: IsoDateTimeString | null;
  clientApprovedAt?: IsoDateTimeString | null;
  approvedAt?: IsoDateTimeString | null;
  workCompletedAt?: IsoDateTimeString | null;
  completedAt?: IsoDateTimeString | null;
  completionReviewStartedAt?: IsoDateTimeString | null;
  readyForInvoicingAt?: IsoDateTimeString | null;
  invoiceSentAt?: IsoDateTimeString | null;
  paidAt?: IsoDateTimeString | null;
  closedAt: IsoDateTimeString | null;
  cancelledAt?: IsoDateTimeString | null;
  holdStartedAt?: IsoDateTimeString | null;
  escalatedAt?: IsoDateTimeString | null;
}

export interface WorkOrderDocument extends FirestoreAuditFields {
  workOrderNumber: string;
  title: string;
  description: string;
  poNumber: string | null;
  requestedByName: string | null;
  requestedByEmail: string | null;
  requestedByPhone: string | null;
  requestedServiceDate: Timestamp | null;
  dueDate: Timestamp | null;
  category: string | null;
  requiresQuote: boolean;
  quoteRequiredThresholdCents: number | null;
  lifecycleStatus: WorkOrderStatus;
  status?: WorkOrderStatus;
  assignmentStatus: AssignmentStatus | null;
  quoteSummaryStatus: WorkOrderQuoteSummaryStatus | null;
  invoiceSummaryStatus: WorkOrderInvoiceSummaryStatus | null;
  approvalStatus: WorkOrderApprovalStatus | null;
  priority: WorkOrderPriority;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  requestedByContactId: EntityId | null;
  siteContactId: EntityId | null;
  coordinatorUserId: EntityId | null;
  managerUserId: EntityId | null;
  assignedCoordinatorUserId: EntityId | null;
  assignedManagerUserId: EntityId | null;
  assignedContractorOrgId: EntityId | null;
  assignedContractorId?: EntityId | null;
  assignedContractorContactId: EntityId | null;
  financeOwnerUserId: EntityId | null;
  quoteReviewerUserId: EntityId | null;
  currentQuoteId: EntityId | null;
  currentInvoiceId: EntityId | null;
  currentQuoteVersionNumber: number | null;
  invoiceNumber: string | null;
  clientSnapshot: EntitySnapshot;
  locationSnapshot: EntitySnapshot & { addressText: string | null };
  contractorSnapshot: EntitySnapshot | null;
  lastActivityAt: Timestamp | null;
  nextActionOwnerType: WorkOrderNextActionOwnerType | null;
  nextActionDueAt: Timestamp | null;
  isEscalated: boolean;
  escalationReason: string | null;
  holdReason: string | null;
  previousLifecycleStatus: WorkOrderStatus | null;
  intakeReceivedAt: Timestamp | null;
  submittedAt?: Timestamp | null;
  triagedAt: Timestamp | null;
  assignedAt: Timestamp | null;
  contractorContactedAt: Timestamp | null;
  contractorRespondedAt: Timestamp | null;
  contractorScheduledAt: Timestamp | null;
  workStartedAt: Timestamp | null;
  quoteRequestedAt: Timestamp | null;
  contractorQuoteReceivedAt: Timestamp | null;
  quoteReviewStartedAt: Timestamp | null;
  clientApprovalRequestedAt: Timestamp | null;
  clientApprovedAt: Timestamp | null;
  approvedAt?: Timestamp | null;
  workCompletedAt: Timestamp | null;
  completedAt?: Timestamp | null;
  completionReviewStartedAt: Timestamp | null;
  readyForInvoicingAt: Timestamp | null;
  invoiceSentAt: Timestamp | null;
  paidAt: Timestamp | null;
  closedAt: Timestamp | null;
  cancelledAt: Timestamp | null;
  holdStartedAt: Timestamp | null;
  escalatedAt: Timestamp | null;
}

export interface ContractorQuote extends DomainAuditFields {
  id: EntityId;
  workOrderId: EntityId;
  contractorUserId: EntityId | null;
  contractorOrganizationId: EntityId | null;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  lineItems: QuoteLineItem[];
  subtotal?: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  status: ContractorQuoteStatus;
  submittedAt: IsoDateTimeString | null;
  reviewedAt: IsoDateTimeString | null;
  reviewedByUserId: EntityId | null;
  rejectionReason: string | null;
  workOrderSnapshot: EntitySnapshot;
  contractorSnapshot: EntitySnapshot | null;
}

export interface ContractorQuoteDocument extends FirestoreAuditFields {
  workOrderId: EntityId;
  contractorUserId: EntityId | null;
  contractorOrganizationId: EntityId | null;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  lineItems: QuoteLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  status: ContractorQuoteStatus;
  submittedAt: Timestamp | null;
  reviewedAt: Timestamp | null;
  reviewedByUserId: EntityId | null;
  rejectionReason: string | null;
  workOrderSnapshot: EntitySnapshot;
  contractorSnapshot: EntitySnapshot | null;
}

export interface ClientQuote extends DomainAuditFields {
  id: EntityId;
  workOrderId: EntityId;
  sourceContractorQuoteId: EntityId | null;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  lineItems: QuoteLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  status: ClientQuoteStatus;
  sentAt: IsoDateTimeString | null;
  respondedAt: IsoDateTimeString | null;
  approvedAt: IsoDateTimeString | null;
  rejectedAt: IsoDateTimeString | null;
  rejectionReason: string | null;
  createdByUserId: EntityId;
  workOrderSnapshot: EntitySnapshot;
}

export interface ClientQuoteDocument extends FirestoreAuditFields {
  workOrderId: EntityId;
  sourceContractorQuoteId: EntityId | null;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  lineItems: QuoteLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  notes: string | null;
  status: ClientQuoteStatus;
  sentAt: Timestamp | null;
  respondedAt: Timestamp | null;
  approvedAt: Timestamp | null;
  rejectedAt: Timestamp | null;
  rejectionReason: string | null;
  createdByUserId: EntityId;
  workOrderSnapshot: EntitySnapshot;
}

export interface ClientInvoice
  extends Omit<
      CanonicalClientInvoice,
      "workOrderSnapshot" | "clientSnapshot" | "locationSnapshot"
    >,
    DomainAuditFields {
  workOrderSnapshot: EntitySnapshot;
  clientSnapshot: EntitySnapshot;
  locationSnapshot: EntitySnapshot;
  issueDate?: IsoDateTimeString | null;
  paidDate?: IsoDateTimeString | null;
  subtotalAmount?: number;
  internalFinanceNotes?: string | null;
}

export interface ClientInvoiceDocument extends FirestoreAuditFields {
  workOrderId: EntityId;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  invoiceNumber: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: InvoiceCurrency;
  status: InvoiceStatus;
  issuedDate: Timestamp | null;
  dueDate: Timestamp;
  sentAt: Timestamp | null;
  viewedAt: Timestamp | null;
  paidAt: Timestamp | null;
  voidedAt: Timestamp | null;
  paymentReference: string | null;
  notes: string | null;
  qboInvoiceId: string | null;
  qboSyncStatus: QboSyncStatus | null;
  workOrderSnapshot: EntitySnapshot;
  clientSnapshot: EntitySnapshot;
  locationSnapshot: EntitySnapshot;
}

export interface Assignment extends DomainAuditFields {
  id: EntityId;
  workOrderId: EntityId;
  contractorOrganizationId: EntityId | null;
  assigneeType: "internal" | "contractor";
  assigneeUserId: EntityId;
  assigneeOrganizationId: EntityId | null;
  assignedByUserId: EntityId;
  status: AssignmentStatus;
  scheduledDate: IsoDateTimeString | null;
  timeWindowStart: IsoDateTimeString | null;
  timeWindowEnd: IsoDateTimeString | null;
  assignedAt: IsoDateTimeString;
  acceptedAt: IsoDateTimeString | null;
  declinedAt: IsoDateTimeString | null;
  completedAt: IsoDateTimeString | null;
  notes: string | null;
  workOrderSnapshot: EntitySnapshot;
  contractorSnapshot: EntitySnapshot | null;
}

export interface AssignmentDocument extends FirestoreAuditFields {
  workOrderId: EntityId;
  contractorOrganizationId: EntityId | null;
  assigneeType: "internal" | "contractor";
  assigneeUserId: EntityId;
  assigneeOrganizationId: EntityId | null;
  assignedByUserId: EntityId;
  status: AssignmentStatus;
  scheduledDate: Timestamp | null;
  timeWindowStart: Timestamp | null;
  timeWindowEnd: Timestamp | null;
  assignedAt: Timestamp;
  acceptedAt: Timestamp | null;
  declinedAt: Timestamp | null;
  completedAt: Timestamp | null;
  notes: string | null;
  workOrderSnapshot: EntitySnapshot;
  contractorSnapshot: EntitySnapshot | null;
}

export type InternalNotificationEventType =
  | "contractor_assigned"
  | "contractor_accepted"
  | "contractor_declined"
  | "contractor_completed_assignment"
  | "quote_submitted"
  | "quote_awaiting_manager_review"
  | "quote_awaiting_client_action"
  | "work_order_stalled"
  | "work_order_ready_for_invoicing"
  | "invoice_created"
  | "invoice_sent"
  | "invoice_overdue"
  | "sla_breach_triggered";

export type InternalNotificationSeverity =
  | "low"
  | "normal"
  | "high"
  | "critical";

export type InternalNotificationStatus = "active" | "resolved";

export interface InternalNotificationActorSummary {
  actorType: "user" | "system";
  userId: EntityId | null;
  role: UserRole | "system" | null;
  displayName: string;
}

export interface InternalNotification extends DomainAuditFields {
  id: EntityId;
  recipientUserId: EntityId;
  recipientRole: UserRole;
  eventType: InternalNotificationEventType;
  title: string;
  message: string;
  severity: InternalNotificationSeverity;
  status: InternalNotificationStatus;
  actor: InternalNotificationActorSummary;
  entityType: "work-order" | "invoice" | "quote" | "assignment";
  entityId: EntityId;
  workOrderId: EntityId | null;
  invoiceId: EntityId | null;
  quoteId: EntityId | null;
  assignmentId: EntityId | null;
  targetPath: string;
  readAt: IsoDateTimeString | null;
  acknowledgedAt: IsoDateTimeString | null;
  resolvedAt: IsoDateTimeString | null;
  dueAt: IsoDateTimeString | null;
  metadata: Record<string, unknown> | null;
}

export interface InternalNotificationDocument extends FirestoreAuditFields {
  recipientUserId: EntityId;
  recipientRole: UserRole;
  eventType: InternalNotificationEventType;
  title: string;
  message: string;
  severity: InternalNotificationSeverity;
  status: InternalNotificationStatus;
  actor: InternalNotificationActorSummary;
  entityType: "work-order" | "invoice" | "quote" | "assignment";
  entityId: EntityId;
  workOrderId: EntityId | null;
  invoiceId: EntityId | null;
  quoteId: EntityId | null;
  assignmentId: EntityId | null;
  targetPath: string;
  readAt: Timestamp | null;
  acknowledgedAt: Timestamp | null;
  resolvedAt: Timestamp | null;
  dueAt: Timestamp | null;
  metadata: Record<string, unknown> | null;
}

export interface ActivityLog extends DomainAuditFields {
  id: EntityId;
  workOrderId: EntityId;
  action: string;
  eventType: string;
  message: string;
  actorType: "user" | "system";
  actorUserId: EntityId | null;
  actorRole: UserRole | "system";
  actor: {
    type: "user" | "system";
    userId: EntityId | null;
    role: UserRole | "system";
  };
  resourceType:
    | "workOrder"
    | "quote"
    | "invoice"
    | "assignment"
    | "clientOrganization"
    | "location"
    | "contractorOrganization";
  resourceId: EntityId;
  resourceLabel: string | null;
  resource: {
    type: ActivityLog["resourceType"];
    id: EntityId;
    label: string | null;
    workOrderId: EntityId;
  };
  entityType:
    | "workOrder"
    | "quote"
    | "invoice"
    | "assignment"
    | "clientOrganization"
    | "location"
    | "contractorOrganization";
  entityId: EntityId;
  occurredAt: IsoDateTimeString;
  requestId: string | null;
  visibility: "internal" | "client" | "contractor" | "all";
  changes: Array<{
    field: string;
    from?: unknown;
    to?: unknown;
  }>;
  metadata: Record<string, unknown>;
}

export interface ActivityLogDocument extends FirestoreAuditFields {
  workOrderId: EntityId;
  action: string;
  eventType: string;
  message: string;
  actorType: ActivityLog["actorType"];
  actorUserId: EntityId | null;
  actorRole: UserRole | "system";
  actor: ActivityLog["actor"];
  resourceType: ActivityLog["resourceType"];
  resourceId: EntityId;
  resourceLabel: string | null;
  resource: ActivityLog["resource"];
  entityType: ActivityLog["entityType"];
  entityId: EntityId;
  occurredAt: Timestamp;
  requestId: string | null;
  visibility: ActivityLog["visibility"];
  changes: ActivityLog["changes"];
  metadata: Record<string, unknown>;
}

export interface DomainEventDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  workOrderId: EntityId | null;
  type: DomainEvent["type"];
  actor: EventActor;
  visibility: EventVisibility;
  occurredAt: Timestamp;
  lifecycleStatus: string | null;
  entity: DomainEvent["entity"];
  summary: string;
  metadata: EventMetadata;
  payload: Record<string, unknown>;
}

export interface TransitionEventDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  workOrderId: EntityId;
  actor: EventActor;
  visibility: EventVisibility;
  occurredAt: Timestamp;
  fromLifecycleStatus: string;
  toLifecycleStatus: string;
  reason: string | null;
  metadata: EventMetadata;
}

export interface TransitionAuditDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  workOrderId: EntityId;
  actor: EventActor;
  occurredAt: Timestamp;
  fromLifecycleStatus: string;
  toLifecycleStatus: string;
  reason: string | null;
  metadata: EventMetadata;
  escalationContext: Record<string, unknown> | null;
  holdContext: Record<string, unknown> | null;
}

export interface IntakeEventDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  status: IntakeEvent["status"];
  visibility: IntakeEvent["visibility"];
  source: IntakeEvent["source"];
  summary: string | null;
  relatedWorkOrderId: EntityId | null;
  artifactIds: EntityId[];
  latestDraftId: EntityId | null;
  latestDecisionId: EntityId | null;
  receivedAt: Timestamp;
  createdByActor: IntakeEvent["createdByActor"];
}

export interface IntakeArtifactDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  intakeEventId: EntityId;
  kind: IntakeArtifact["kind"];
  visibility: IntakeArtifact["visibility"];
  isImmutable: true;
  source: IntakeArtifact["source"];
  normalizedContent: string;
  rawContent: string | null;
  structuredMetadata: Record<string, unknown>;
  attachmentReferences: IntakeArtifact["attachmentReferences"];
  communicationThreadId: EntityId | null;
  communicationMessageId: EntityId | null;
  createdByActor: IntakeArtifact["createdByActor"];
}

export interface AiIntakeDraftDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  intakeEventId: EntityId;
  artifactIds: EntityId[];
  reviewStatus: AiIntakeDraft["reviewStatus"];
  extractedTitle: string | null;
  extractedDescription: string | null;
  extractedPriority: AiIntakeDraft["extractedPriority"];
  extractedCategory: string | null;
  extractedLocation: AiIntakeDraft["extractedLocation"];
  extractedClient: AiIntakeDraft["extractedClient"];
  extractedContacts: AiIntakeDraft["extractedContacts"];
  extractedTrade: string | null;
  extractedUrgency: string | null;
  extractedSuggestedLifecycle: AiIntakeDraft["extractedSuggestedLifecycle"];
  overallConfidence: number;
  perFieldConfidence: AiIntakeDraft["perFieldConfidence"];
  evidence: AiIntakeDraft["evidence"];
  evidenceReferences: EntityId[];
  extractedSnippets: string[];
  locationCandidates: AiIntakeDraft["locationCandidates"];
  contactCandidates: AiIntakeDraft["contactCandidates"];
  duplicateCandidates: AiIntakeDraft["duplicateCandidates"];
  workOrderMatchSuggestions: AiIntakeDraft["workOrderMatchSuggestions"];
  aiModel: string;
  aiPromptVersion: string;
  aiRunId: string;
  generatedAt: Timestamp;
  assignedReviewerUserId: EntityId | null;
  assignedAt: Timestamp | null;
  reviewStartedAt: Timestamp | null;
  lastReviewedAt: Timestamp | null;
  escalationState: AiIntakeDraft["escalationState"];
  escalatedToUserId: EntityId | null;
  escalatedAt: Timestamp | null;
  reviewerUserId: EntityId | null;
  reviewerDecision: AiIntakeDraft["reviewerDecision"];
  reviewerNotes: string | null;
  approvedWorkOrderId: EntityId | null;
  rejectedReason: string | null;
  mergedIntoWorkOrderId: EntityId | null;
  createdByActor: AiIntakeDraft["createdByActor"];
}

export interface IntakeApprovalDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  intakeEventId: EntityId;
  aiIntakeDraftId: EntityId;
  reviewerUserId: EntityId;
  decision: IntakeApproval["decision"];
  reviewerNotes: string | null;
  approvedInput: IntakeApproval["approvedInput"];
  approvedWorkOrderId: EntityId | null;
  mergedIntoWorkOrderId: EntityId | null;
  duplicateResolution: IntakeApproval["duplicateResolution"];
  createdByActor: IntakeApproval["createdByActor"];
}

export interface IntakeDecisionDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  intakeEventId: EntityId;
  aiIntakeDraftId: EntityId;
  reviewerUserId: EntityId;
  decision: IntakeDecision["decision"];
  notes: string | null;
  approvedWorkOrderId: EntityId | null;
  mergedIntoWorkOrderId: EntityId | null;
  rejectedReason: string | null;
  escalatedToUserId: EntityId | null;
  createdByActor: IntakeDecision["createdByActor"];
  metadata: Record<string, unknown>;
}

export interface CommunicationThreadDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  workOrderId: EntityId | null;
  channel: CommunicationChannel;
  subject: string | null;
  visibility: CommunicationVisibility[];
  participantIds: EntityId[];
  relatedEventIds: EntityId[];
  linkedEntityIds: EntityId[];
  lastMessageId: EntityId | null;
  lastMessageAt: Timestamp | null;
  externalProvider: string | null;
  externalThreadId: string | null;
  metadata: Record<string, unknown>;
  createdByActor: CommunicationActorReference;
}

export interface CommunicationMessageDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  threadId: EntityId;
  workOrderId: EntityId | null;
  referenceMessageId: EntityId | null;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  visibility: CommunicationVisibility[];
  subject: string | null;
  body: string;
  plainTextBody: string;
  normalizedContent: string;
  metadata: Record<string, unknown>;
  senderActorId: EntityId | null;
  senderActorType: CommunicationMessage["senderActorType"];
  senderActorRole: CommunicationMessage["senderActorRole"];
  participantIds: EntityId[];
  clientContactId: EntityId | null;
  contractorOrganizationId: EntityId | null;
  linkedEntityIds: EntityId[];
  relatedEventIds: EntityId[];
  sentAt: Timestamp | null;
  deliveredAt: Timestamp | null;
  readAt: Timestamp | null;
  externalProvider: string | null;
  externalThreadId: string | null;
  externalMessageId: string | null;
  createdByActor: CommunicationActorReference;
}

export interface CommunicationParticipantDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  threadId: EntityId;
  workOrderId: EntityId | null;
  actorType: CommunicationParticipant["actorType"];
  userId: EntityId | null;
  userRole: CommunicationParticipant["userRole"];
  contactId: EntityId | null;
  clientOrganizationId: EntityId | null;
  contractorOrganizationId: EntityId | null;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  visibility: CommunicationVisibility[];
  joinedAt: Timestamp;
  metadata: Record<string, unknown>;
}

export interface CommunicationLinkDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  threadId: EntityId | null;
  messageId: EntityId | null;
  workOrderId: EntityId | null;
  entityType: CommunicationLink["entityType"];
  entityId: EntityId;
  relationshipType: CommunicationLink["relationshipType"];
  createdAt: Timestamp;
  createdByActor: CommunicationActorReference;
  metadata: Record<string, unknown>;
}

export interface CommunicationAttachmentDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  threadId: EntityId;
  messageId: EntityId;
  workOrderId: EntityId | null;
  fileName: string;
  contentType: string | null;
  sizeBytes: number;
  storagePath: string;
  hydrationStatus: CommunicationAttachment["hydrationStatus"];
  hydratedAt: Timestamp | null;
  hydrationError: string | null;
  contentHash: string | null;
  visibility: CommunicationVisibility[];
  uploadedByActor: CommunicationActorReference;
  externalProvider: string | null;
  externalAttachmentId: string | null;
  metadata: Record<string, unknown>;
}

export interface CommunicationMatchSuggestionDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  threadId: EntityId | null;
  messageId: EntityId;
  workOrderId: EntityId | null;
  suggestedEntityType: CommunicationMatchSuggestion["suggestedEntityType"];
  suggestedEntityId: EntityId;
  confidenceScore: number;
  status: CommunicationMatchSuggestion["status"];
  suggestedAt: Timestamp;
  reviewedAt: Timestamp | null;
  reviewedByActor: CommunicationActorReference | null;
  rationale: string | null;
  metadata: Record<string, unknown>;
}

export interface ProviderConnectionDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  providerKey: ProviderConnection["providerKey"];
  providerTenantId: string | null;
  providerAccountId: string | null;
  mailboxAddress: string | null;
  displayName: string | null;
  scopes: string[];
  scopeMetadata: Record<string, unknown>;
  status: ProviderConnection["status"];
  healthStatus: ProviderConnection["healthStatus"];
  ownerUserId: EntityId | null;
  connectedAt: Timestamp | null;
  disabledAt: Timestamp | null;
  expiresAt: Timestamp | null;
  lastHealthyAt: Timestamp | null;
  lastError: ProviderConnection["lastError"];
  lastSyncedAt: Timestamp | null;
  metadata: Record<string, unknown>;
}

export interface ProviderSyncCheckpointDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  providerKey: ProviderSyncCheckpoint["providerKey"];
  providerConnectionId: EntityId | null;
  checkpointType: ProviderSyncCheckpoint["checkpointType"];
  mailboxScope: ProviderSyncCheckpoint["mailboxScope"];
  cursor: string | null;
  lastProcessedReceivedAt: Timestamp | null;
  lastAttemptedAt: Timestamp | null;
  lastSuccessfulSyncAt: Timestamp | null;
  status: ProviderSyncCheckpoint["status"];
  failureCount: number;
  lastError: ProviderSyncCheckpoint["lastError"];
  nextRetryAt: Timestamp | null;
  metadata: Record<string, unknown>;
}

export interface ProviderSyncRunDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  connectionId: EntityId;
  providerKey: ProviderSyncRun["providerKey"];
  mailboxScope: ProviderSyncRun["mailboxScope"];
  startedAt: Timestamp;
  completedAt: Timestamp | null;
  status: ProviderSyncRun["status"];
  messagesSeen: number;
  messagesIngested: number;
  duplicatesSkipped: number;
  failures: number;
  checkpointBefore: ProviderSyncRun["checkpointBefore"];
  checkpointAfter: ProviderSyncRun["checkpointAfter"];
  errorSummary: string | null;
  claim: ProviderSyncRun["claim"];
  metadata: Record<string, unknown>;
}

export interface ProviderMessageReceiptDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  providerKey: ProviderMessageReceipt["providerKey"];
  providerConnectionId: EntityId | null;
  providerMessageId: string | null;
  internetMessageId: string | null;
  providerThreadId: string | null;
  canonicalThreadId: EntityId | null;
  canonicalMessageId: EntityId | null;
  intakeEventId: EntityId | null;
  attachmentIds: EntityId[];
  fingerprint: string;
  status: ProviderMessageReceipt["status"];
  visibility: ProviderMessageReceipt["visibility"];
  receivedAt: Timestamp;
  processedAt: Timestamp;
  failureReason: string | null;
  reviewedAt: Timestamp | null;
  reviewedByUserId: EntityId | null;
  supersededByReceiptId: EntityId | null;
  metadata: Record<string, unknown>;
}

export interface ProviderThreadMappingDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  providerKey: ProviderThreadMapping["providerKey"];
  providerConnectionId: EntityId | null;
  providerThreadId: string;
  canonicalThreadId: EntityId;
  latestProviderMessageId: string | null;
  latestInternetMessageId: string | null;
  latestCanonicalMessageId: EntityId | null;
  messageCount: number;
  threadFingerprint: string;
  metadata: Record<string, unknown>;
}

export interface WorkerJobDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  type: string;
  status: WorkerJob["status"];
  payload: Record<string, unknown>;
  payloadVersion: string;
  idempotencyKey: string;
  correlationId: string;
  causationId: string;
  sourceEventId: EntityId | null;
  attemptCount: number;
  maxAttempts: number;
  runAfter: Timestamp;
  leasedBy: string | null;
  leaseExpiresAt: Timestamp | null;
  lastError: WorkerJob["lastError"];
  completedAt: Timestamp | null;
}

export interface WorkerDeadLetterDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  originalJobId: EntityId;
  jobType: string;
  payloadSnapshot: Record<string, unknown> | null;
  payloadReference: string | null;
  errorSummary: string;
  finalAttemptCount: number;
  correlationId: string;
  causationId: string;
  sourceEventId: EntityId | null;
}

export interface EventProcessingDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  subscriberKey: string;
  subscriberName: string;
  sourceEventId: EntityId;
  eventType: EventProcessingRecord["eventType"];
  correlationId: string;
  causationId: string;
  idempotencyKey: string;
  status: EventProcessingRecord["status"];
  attemptCount: number;
  jobCount: number;
  jobs: EventProcessingRecord["jobs"];
  lastError: EventProcessingRecord["lastError"];
  completedAt: Timestamp | null;
}

export interface DeliveryPlanDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  deliveryType: CanonicalDeliveryPlan["deliveryType"];
  sourceEscalationId: EntityId;
  sourceEscalationStageNumber: number | null;
  sourceEventId: EntityId;
  correlationId: string;
  causationId: string;
  idempotencyKey: string;
  targetEntityType: CanonicalDeliveryPlan["targetEntityType"];
  targetEntityId: EntityId;
  recipientType: CanonicalDeliveryPlan["recipientType"];
  recipientId: EntityId;
  recipientAddress: string;
  channel: CanonicalDeliveryPlan["channel"];
  templateId: string;
  templateVersion: string;
  priority: CanonicalDeliveryPlan["priority"];
  status: CanonicalDeliveryPlan["status"];
  retryCount: number;
  nextAttemptAt: Timestamp | null;
  suppressionReason: string | null;
  cancellationReason: string | null;
  activeRuntimeJobId: EntityId | null;
  noopCount: number;
}

export interface DeliveryAttemptDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  deliveryPlanId: EntityId;
  deliveryType: DeliveryAttempt["deliveryType"];
  channel: DeliveryAttempt["channel"];
  adapterType: DeliveryAttempt["adapterType"];
  sourceEventId: EntityId;
  correlationId: string;
  causationId: string;
  idempotencyKey: string;
  status: DeliveryAttempt["status"];
  providerMessageId: string | null;
  providerCorrelationId: string | null;
  providerReceiptId: string | null;
  retryCount: number;
  nextRetryAt: Timestamp | null;
  executionStartedAt: Timestamp | null;
  executionCompletedAt: Timestamp | null;
  failureCode: string | null;
  failureReason: string | null;
  emittedEventIds: EntityId[];
}

export interface EscalationOrchestrationDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  escalationType: EscalationOrchestration["escalationType"];
  targetEntityType: EscalationOrchestration["targetEntityType"];
  targetEntityId: EntityId;
  sourceSlaTimerId: EntityId;
  sourceEventId: EntityId;
  correlationId: string;
  causationId: string;
  idempotencyKey: string;
  status: EscalationOrchestration["status"];
  currentStage: EscalationOrchestration["currentStage"];
  stageHistory: EscalationOrchestration["stageHistory"];
  activeRuntimeJobId: EntityId | null;
  nextStageAt: Timestamp | null;
  suppressedReason: string | null;
  cancellationReason: string | null;
  resolvedAt: Timestamp | null;
  lastProgressedAt: Timestamp | null;
  progressionAttemptCount: number;
  noopCount: number;
}

export interface SlaTimerDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  type: SlaTimer["type"];
  targetEntityType: SlaTimer["targetEntityType"];
  targetEntityId: EntityId;
  status: SlaTimer["status"];
  dueAt: Timestamp;
  policyVersion: string;
  payloadVersion: string;
  condition: SlaTimer["condition"];
  sourceEventId: EntityId;
  correlationId: string;
  causationId: string;
  idempotencyKey: string;
  runtimeJobId: EntityId | null;
  evaluatedAt: Timestamp | null;
  satisfiedAt: Timestamp | null;
  breachedAt: Timestamp | null;
  cancelledAt: Timestamp | null;
  failureReason: string | null;
}

export interface SlaScanCursorDocument extends FirestoreAuditFields {
  tenantId: EntityId;
  scanType: SlaScanCursor["scanType"];
  timerType: string | null;
  lastScannedDueAt: Timestamp | null;
  lastScannedId: EntityId | null;
  lastCompletedAt: Timestamp | null;
  status: SlaScanCursor["status"];
  correlationId: string;
  recentRuns: SlaScanCursor["recentRuns"];
}
