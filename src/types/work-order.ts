import type {
  AuditableEntity,
  CreateEntityInput,
  EntityId,
  IsoDateTimeString,
  UpdateEntityInput,
} from "@/types/entity";
import type { CommunicationTimelineEntry } from "@/modules/communications";
import type { WorkOrderLifecycleStatus } from "@/modules/work-orders";

export type WorkOrderStatus = WorkOrderLifecycleStatus;

export type WorkOrderPriority = "low" | "medium" | "high" | "urgent";

export type WorkOrderCategory = string;

export type WorkOrderNextActionOwnerType =
  | "owner"
  | "manager"
  | "coordinator"
  | "finance_admin"
  | "client_head_office"
  | "client_store"
  | "contractor_admin"
  | "contractor_technician"
  | "system";

export type WorkOrderApprovalStatus =
  | "not_required"
  | "pending_internal_review"
  | "pending_client_approval"
  | "approved"
  | "rejected";

export type WorkOrderQuoteSummaryStatus =
  | "not_required"
  | "required"
  | "awaiting_contractor_quote"
  | "received"
  | "under_review"
  | "client_approval_requested"
  | "client_approved"
  | "rejected"
  | "superseded";

export type WorkOrderInvoiceSummaryStatus =
  | "not_ready"
  | "ready"
  | "draft"
  | "sent"
  | "viewed"
  | "overdue"
  | "disputed"
  | "resolved"
  | "paid"
  | "void";

export interface WorkOrderOwnershipReference {
  clientOrganizationId: EntityId;
  locationId: EntityId;
}

export interface WorkOrder extends AuditableEntity, WorkOrderOwnershipReference {
  workOrderNumber: string;
  poNumber?: string | null;
  requestedByContactId?: EntityId | null;
  siteContactId?: EntityId | null;
  coordinatorUserId?: EntityId | null;
  managerUserId?: EntityId | null;
  assignedContractorId?: EntityId | null;
  assignedCoordinatorUserId?: EntityId | null;
  assignedManagerUserId?: EntityId | null;
  assignedContractorOrgId?: EntityId | null;
  assignedContractorContactId?: EntityId | null;
  financeOwnerUserId?: EntityId | null;
  quoteReviewerUserId?: EntityId | null;
  requestedServiceDate?: IsoDateTimeString | null;
  dueDate?: IsoDateTimeString | null;
  category?: WorkOrderCategory | null;
  requiresQuote?: boolean;
  quoteRequiredThresholdCents?: number | null;
  shortDescription: string;
  description: string;
  lifecycleStatus: WorkOrderStatus;
  status: WorkOrderStatus;
  assignmentStatus?: AssignmentStatus;
  quoteSummaryStatus?: WorkOrderQuoteSummaryStatus;
  invoiceSummaryStatus?: WorkOrderInvoiceSummaryStatus;
  approvalStatus?: WorkOrderApprovalStatus;
  priority: WorkOrderPriority;
  currentQuoteId?: EntityId | null;
  currentInvoiceId?: EntityId | null;
  currentQuoteVersionNumber?: number | null;
  invoiceNumber?: string | null;
  lastActivityAt?: IsoDateTimeString | null;
  nextActionOwnerType?: WorkOrderNextActionOwnerType | null;
  nextActionDueAt?: IsoDateTimeString | null;
  isEscalated?: boolean;
  escalationReason?: string | null;
  holdReason?: string | null;
  previousLifecycleStatus?: WorkOrderStatus | null;
  paymentReference?: string | null;
  invoiceDisputeFlag?: boolean;
  quoteRequired?: boolean;
  submittedAt?: IsoDateTimeString | null;
  intakeReceivedAt?: IsoDateTimeString | null;
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
  closedAt?: IsoDateTimeString | null;
  cancelledAt?: IsoDateTimeString | null;
  holdStartedAt?: IsoDateTimeString | null;
  escalatedAt?: IsoDateTimeString | null;
}

export interface CreateWorkOrderInput
  extends CreateEntityInput,
    WorkOrderOwnershipReference {
  workOrderNumber?: string;
  poNumber?: string;
  requestedByContactId?: EntityId;
  siteContactId?: EntityId;
  coordinatorUserId?: EntityId;
  managerUserId?: EntityId;
  assignedContractorId?: EntityId;
  requestedServiceDate?: IsoDateTimeString;
  dueDate?: IsoDateTimeString;
  category?: WorkOrderCategory;
  requiresQuote?: boolean;
  quoteRequiredThresholdCents?: number;
  shortDescription: string;
  description: string;
  priority: WorkOrderPriority;
  lifecycleStatus?: WorkOrderStatus;
}

export interface UpdateWorkOrderInput extends UpdateEntityInput {
  workOrderNumber?: string;
  poNumber?: string | null;
  clientOrganizationId?: EntityId;
  locationId?: EntityId;
  requestedByContactId?: EntityId | null;
  siteContactId?: EntityId | null;
  coordinatorUserId?: EntityId | null;
  managerUserId?: EntityId | null;
  assignedContractorId?: EntityId | null;
  requestedServiceDate?: IsoDateTimeString | null;
  dueDate?: IsoDateTimeString | null;
  category?: WorkOrderCategory | null;
  requiresQuote?: boolean;
  quoteRequiredThresholdCents?: number | null;
  shortDescription?: string | null;
  description?: string;
  lifecycleStatus?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  currentQuoteId?: EntityId | null;
  currentInvoiceId?: EntityId | null;
  submittedAt?: IsoDateTimeString | null;
  approvedAt?: IsoDateTimeString | null;
  completedAt?: IsoDateTimeString | null;
  closedAt?: IsoDateTimeString | null;
}

export type AssignmentAssigneeType = "internal" | "contractor";

export type AssignmentStatus =
  | "assigned"
  | "accepted"
  | "declined"
  | "cancelled"
  | "completed";

export interface AssignmentOwnershipReference {
  workOrderId: EntityId;
  contractorOrganizationId: EntityId;
}

export interface Assignment extends AuditableEntity, AssignmentOwnershipReference {
  assigneeType: AssignmentAssigneeType;
  assigneeUserId: EntityId;
  assigneeOrganizationId?: EntityId | null;
  assignedByUserId: EntityId;
  status: AssignmentStatus;
  scheduledDate?: IsoDateTimeString | null;
  timeWindowStart?: IsoDateTimeString | null;
  timeWindowEnd?: IsoDateTimeString | null;
  assignedAt: IsoDateTimeString;
  acceptedAt?: IsoDateTimeString | null;
  declinedAt?: IsoDateTimeString | null;
  completedAt?: IsoDateTimeString;
  notes?: string;
}

export interface CreateAssignmentInput
  extends CreateEntityInput,
    AssignmentOwnershipReference {
  assigneeType: AssignmentAssigneeType;
  assigneeUserId: EntityId;
  assigneeOrganizationId?: EntityId | null;
  assignedByUserId: EntityId;
  scheduledDate?: IsoDateTimeString | null;
  timeWindowStart?: IsoDateTimeString | null;
  timeWindowEnd?: IsoDateTimeString | null;
  assignedAt: IsoDateTimeString;
  status?: AssignmentStatus;
  notes?: string;
}

export interface UpdateAssignmentInput extends UpdateEntityInput {
  workOrderId?: EntityId;
  contractorOrganizationId?: EntityId;
  assigneeType?: AssignmentAssigneeType;
  assigneeUserId?: EntityId;
  assigneeOrganizationId?: EntityId | null;
  assignedByUserId?: EntityId;
  status?: AssignmentStatus;
  scheduledDate?: IsoDateTimeString | null;
  timeWindowStart?: IsoDateTimeString | null;
  timeWindowEnd?: IsoDateTimeString | null;
  assignedAt?: IsoDateTimeString;
  acceptedAt?: IsoDateTimeString | null;
  declinedAt?: IsoDateTimeString | null;
  completedAt?: IsoDateTimeString;
  notes?: string;
}

export interface ClientPortalWorkOrderSummary {
  id: EntityId;
  workOrderNumber: string;
  shortDescription: string;
  lifecycleStatus: WorkOrderStatus;
  priority: WorkOrderPriority;
  clientOrganizationId?: EntityId;
  locationId: EntityId;
  locationName: string;
  category?: WorkOrderCategory | null;
  poNumber?: string | null;
  requestedServiceDate?: IsoDateTimeString | null;
  dueDate?: IsoDateTimeString | null;
  requiresQuote?: boolean;
  quoteRequiredThresholdCents?: number | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  currentQuoteStatus?: string | null;
  currentQuoteId?: EntityId | null;
}

export interface ClientPortalWorkOrderDetail
  extends ClientPortalWorkOrderSummary {
  clientOrganizationId: EntityId;
  clientOrganizationName: string;
  description: string;
  locationCode?: string | null;
  locationAddress?: string | null;
  requestedByContactId?: EntityId | null;
  siteContactId?: EntityId | null;
  coordinatorUserId?: EntityId | null;
  managerUserId?: EntityId | null;
  assignedContractorId?: EntityId | null;
  dueDate?: IsoDateTimeString | null;
  closedAt?: IsoDateTimeString | null;
  activeQuote?: {
    id: EntityId;
    status: string;
    totalAmount: number;
    sentAt?: IsoDateTimeString | null;
    respondedAt?: IsoDateTimeString | null;
  } | null;
  communications?: CommunicationTimelineEntry[];
}
