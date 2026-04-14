import "server-only";

import type { Timestamp } from "firebase-admin/firestore";
import type { EntityId, IsoDateTimeString, RecordStatus } from "@/types/entity";
import type { ContractorStatus } from "@/modules/contractors";
import type { UserRole } from "@/types/permissions";
import type {
  AssignmentStatus,
  WorkOrderPriority,
  WorkOrderStatus,
} from "@/types/work-order";
import type {
  ClientQuoteStatus,
  ContractorQuoteStatus,
  QuoteLineItem,
  QuoteStatus,
} from "@/types/quote";
import type {
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

export interface ClientOrganization extends DomainAuditFields {
  id: EntityId;
  name: string;
  displayName: string | null;
  status: FirestoreOrganizationStatus;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  billingEmail: string | null;
  notes: string | null;
}

export interface ClientOrganizationDocument extends FirestoreAuditFields {
  name: string;
  displayName: string | null;
  status: FirestoreOrganizationStatus;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  billingEmail: string | null;
  notes: string | null;
}

export interface Location extends DomainAuditFields {
  id: EntityId;
  clientOrganizationId: EntityId;
  clientSnapshot: EntitySnapshot;
  name: string;
  code: string | null;
  status: FirestoreOrganizationStatus;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  locationContactName: string | null;
  locationContactEmail: string | null;
  locationContactPhone: string | null;
  accessNotes: string | null;
  notes: string | null;
}

export interface LocationDocument extends FirestoreAuditFields {
  clientOrganizationId: EntityId;
  clientSnapshot: EntitySnapshot;
  name: string;
  code: string | null;
  status: FirestoreOrganizationStatus;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  countryCode: string | null;
  locationContactName: string | null;
  locationContactEmail: string | null;
  locationContactPhone: string | null;
  accessNotes: string | null;
  notes: string | null;
}

export interface ContractorOrganization extends DomainAuditFields {
  id: EntityId;
  name: string;
  displayName: string | null;
  status: FirestoreContractorOrganizationStatus;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  serviceCategories: string[];
  serviceAreas: string[];
  notes: string | null;
}

export interface ContractorOrganizationDocument extends FirestoreAuditFields {
  name: string;
  displayName: string | null;
  status: FirestoreContractorOrganizationStatus;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  primaryContactPhone: string | null;
  serviceCategories: string[];
  serviceAreas: string[];
  notes: string | null;
}

export interface WorkOrder extends DomainAuditFields {
  id: EntityId;
  workOrderNumber: string;
  title: string;
  description: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  requestedByUserId: EntityId | null;
  assignedCoordinatorUserId: EntityId | null;
  assignedManagerUserId: EntityId | null;
  assignedContractorOrganizationId: EntityId | null;
  currentQuoteId: EntityId | null;
  currentInvoiceId: EntityId | null;
  clientSnapshot: EntitySnapshot;
  locationSnapshot: EntitySnapshot & { addressText: string | null };
  contractorSnapshot: EntitySnapshot | null;
  category: string | null;
  requestedServiceDate: IsoDateTimeString | null;
  submittedAt: IsoDateTimeString | null;
  approvedAt: IsoDateTimeString | null;
  completedAt: IsoDateTimeString | null;
  closedAt: IsoDateTimeString | null;
}

export interface WorkOrderDocument extends FirestoreAuditFields {
  workOrderNumber: string;
  title: string;
  description: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  requestedByUserId: EntityId | null;
  assignedCoordinatorUserId: EntityId | null;
  assignedManagerUserId: EntityId | null;
  assignedContractorOrganizationId: EntityId | null;
  currentQuoteId: EntityId | null;
  currentInvoiceId: EntityId | null;
  clientSnapshot: EntitySnapshot;
  locationSnapshot: EntitySnapshot & { addressText: string | null };
  contractorSnapshot: EntitySnapshot | null;
  category: string | null;
  requestedServiceDate: Timestamp | null;
  submittedAt: Timestamp | null;
  approvedAt: Timestamp | null;
  completedAt: Timestamp | null;
  closedAt: Timestamp | null;
}

export interface Quote extends DomainAuditFields {
  id: EntityId;
  workOrderId: EntityId;
  clientOrganizationId?: EntityId;
  locationId?: EntityId;
  contractorOrganizationId: EntityId | null;
  versionNumber: number;
  status: QuoteStatus;
  laborAmount: number;
  materialAmount: number;
  otherAmount: number;
  totalAmount: number;
  currency: InvoiceCurrency;
  scopeSummary: string;
  contractorNotes: string | null;
  internalReviewNotes: string | null;
  clientResponseNotes: string | null;
  submittedByUserId: EntityId | null;
  submittedAt: IsoDateTimeString | null;
  reviewedAt: IsoDateTimeString | null;
  clientDecisionAt: IsoDateTimeString | null;
  workOrderSnapshot: EntitySnapshot;
  contractorSnapshot: EntitySnapshot | null;
}

export interface QuoteDocument extends FirestoreAuditFields {
  workOrderId: EntityId;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  contractorOrganizationId: EntityId | null;
  versionNumber: number;
  status: QuoteStatus;
  laborAmount: number;
  materialAmount: number;
  otherAmount: number;
  totalAmount: number;
  currency: InvoiceCurrency;
  scopeSummary: string;
  contractorNotes: string | null;
  internalReviewNotes: string | null;
  clientResponseNotes: string | null;
  submittedByUserId: EntityId | null;
  submittedAt: Timestamp | null;
  reviewedAt: Timestamp | null;
  clientDecisionAt: Timestamp | null;
  workOrderSnapshot: EntitySnapshot;
  contractorSnapshot: EntitySnapshot | null;
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

export interface Invoice extends DomainAuditFields {
  id: EntityId;
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
  issuedDate: IsoDateTimeString | null;
  dueDate: IsoDateTimeString;
  sentAt: IsoDateTimeString | null;
  viewedAt: IsoDateTimeString | null;
  paidAt: IsoDateTimeString | null;
  voidedAt: IsoDateTimeString | null;
  paymentReference: string | null;
  notes: string | null;
  qboInvoiceId: string | null;
  qboSyncStatus: QboSyncStatus | null;
  workOrderSnapshot: EntitySnapshot;
  clientSnapshot: EntitySnapshot;
  locationSnapshot: EntitySnapshot;
  issueDate?: IsoDateTimeString | null;
  paidDate?: IsoDateTimeString | null;
  subtotalAmount?: number;
  internalFinanceNotes?: string | null;
}

export interface InvoiceDocument extends FirestoreAuditFields {
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
