import "server-only";

import type { Timestamp } from "firebase-admin/firestore";
import type { EntityId, IsoDateTimeString, RecordStatus } from "@/types/entity";
import type { UserRole } from "@/types/permissions";
import type {
  AssignmentStatus,
  WorkOrderPriority,
  WorkOrderStatus,
} from "@/types/work-order";
import type { QuoteStatus } from "@/types/quote";
import type { InvoiceCurrency, InvoiceLineItem, InvoiceStatus } from "@/types/invoice";

export type FirestoreRecordStatus = RecordStatus;
export type FirestoreOrganizationStatus = "active" | "inactive";
export type FirestoreContractorOrganizationStatus =
  | "active"
  | "inactive"
  | "pending_approval";
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

export interface Invoice extends DomainAuditFields {
  id: EntityId;
  workOrderId: EntityId;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  invoiceNumber: string;
  status: InvoiceStatus;
  issueDate: IsoDateTimeString | null;
  dueDate: IsoDateTimeString;
  paidDate: IsoDateTimeString | null;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: InvoiceCurrency;
  lineItems: InvoiceLineItem[];
  internalFinanceNotes: string | null;
  paymentReference: string | null;
  workOrderSnapshot: EntitySnapshot;
  clientSnapshot: EntitySnapshot;
  locationSnapshot: EntitySnapshot;
}

export interface InvoiceDocument extends FirestoreAuditFields {
  workOrderId: EntityId;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  invoiceNumber: string;
  status: InvoiceStatus;
  issueDate: Timestamp | null;
  dueDate: Timestamp;
  paidDate: Timestamp | null;
  subtotalAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: InvoiceCurrency;
  lineItems: InvoiceLineItem[];
  internalFinanceNotes: string | null;
  paymentReference: string | null;
  workOrderSnapshot: EntitySnapshot;
  clientSnapshot: EntitySnapshot;
  locationSnapshot: EntitySnapshot;
}

export interface Assignment extends DomainAuditFields {
  id: EntityId;
  workOrderId: EntityId;
  contractorOrganizationId: EntityId;
  assignedByUserId: EntityId;
  status: AssignmentStatus;
  assignedAt: IsoDateTimeString;
  respondedAt: IsoDateTimeString | null;
  completedAt: IsoDateTimeString | null;
  notes: string | null;
  workOrderSnapshot: EntitySnapshot;
  contractorSnapshot: EntitySnapshot;
}

export interface AssignmentDocument extends FirestoreAuditFields {
  workOrderId: EntityId;
  contractorOrganizationId: EntityId;
  assignedByUserId: EntityId;
  status: AssignmentStatus;
  assignedAt: Timestamp;
  respondedAt: Timestamp | null;
  completedAt: Timestamp | null;
  notes: string | null;
  workOrderSnapshot: EntitySnapshot;
  contractorSnapshot: EntitySnapshot;
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
