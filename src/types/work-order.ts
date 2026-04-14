import type {
  AuditableEntity,
  CreateEntityInput,
  EntityId,
  IsoDateTimeString,
  UpdateEntityInput,
} from "@/types/entity";

export type WorkOrderStatus =
  | "new"
  | "in_review"
  | "draft"
  | "submitted"
  | "quote_requested"
  | "quote_received"
  | "pending_client_approval"
  | "approved_to_proceed"
  | "dispatched"
  | "assigned"
  | "in_progress"
  | "waiting_on_contractor"
  | "waiting_on_customer"
  | "quoted"
  | "approved"
  | "scheduled"
  | "completed"
  | "invoiced"
  | "paid"
  | "closed"
  | "cancelled";

export type WorkOrderPriority = "low" | "medium" | "high" | "urgent";

export type PhaseOneWorkOrderStatus =
  | "new"
  | "in_review"
  | "quote_requested"
  | "quote_received"
  | "pending_client_approval"
  | "approved_to_proceed"
  | "dispatched"
  | "in_progress"
  | "completed"
  | "invoiced"
  | "paid"
  | "closed"
  | "cancelled";

export type PhaseOneActivityType =
  | "created"
  | "edited"
  | "status_changed"
  | "note_updated"
  | "contractor_assigned"
  | "contractor_status_updated"
  | "contractor_completion_notes_added"
  | "quote_requested"
  | "quote_submitted"
  | "quote_revised"
  | "quote_sent_for_client_approval"
  | "quote_client_approved"
  | "quote_client_rejected"
  | "invoice_draft_created"
  | "invoice_updated"
  | "invoice_issued"
  | "invoice_marked_paid"
  | "invoice_marked_overdue"
  | "invoice_voided";

export interface PhaseOneWorkOrder {
  id: EntityId;
  workOrderNumber: string;
  status: PhaseOneWorkOrderStatus;
  requiresQuote: boolean;
  currentQuoteId: EntityId | null;
  currentInvoiceId: EntityId | null;
  priority: WorkOrderPriority;
  title: string;
  description: string;
  clientId: EntityId;
  locationId: EntityId;
  clientName: string;
  locationName: string;
  locationAddress: string;
  contactName: string;
  contactPhone: string;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  requestedServiceDate: IsoDateTimeString | null;
  assignedCoordinatorName: string | null;
  assignedManagerName: string | null;
  assignedContractorId: string | null;
  assignedContractorName: string | null;
  contractorAssignedAt: IsoDateTimeString | null;
  contractorAssignedBy: string | null;
  category: string | null;
  internalNotes: string | null;
  completionNotes: string | null;
  createdBy: string;
  lastUpdatedBy: string;
}

export interface ActivityEntry {
  id: EntityId;
  workOrderId: EntityId;
  type: PhaseOneActivityType;
  message: string;
  createdAt: IsoDateTimeString;
  actorName: string;
  actorRole: string;
}

export type PhaseOneCreateWorkOrderInput = Pick<
  PhaseOneWorkOrder,
  | "title"
  | "description"
  | "clientId"
  | "locationId"
  | "priority"
  | "requestedServiceDate"
  | "assignedCoordinatorName"
  | "assignedManagerName"
  | "category"
  | "internalNotes"
>;

export type PhaseOneUpdateWorkOrderInput = Partial<
  Pick<
    PhaseOneWorkOrder,
    | "title"
    | "description"
    | "priority"
    | "requestedServiceDate"
    | "clientId"
    | "locationId"
    | "assignedCoordinatorName"
    | "assignedManagerName"
    | "category"
    | "internalNotes"
    | "completionNotes"
  >
>;

export interface WorkOrderOwnershipReference {
  clientOrganizationId: EntityId;
  locationId: EntityId;
}

export interface WorkOrderLocationLinkage extends WorkOrderOwnershipReference {}

export interface WorkOrderLocationValidationReference {
  id: EntityId;
  clientOrganizationId: EntityId;
  status: "active" | "inactive";
}

export interface WorkOrder extends AuditableEntity, WorkOrderOwnershipReference {
  requestedByUserId: EntityId;
  title: string;
  description: string;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  submittedAt?: IsoDateTimeString;
  approvedAt?: IsoDateTimeString;
  completedAt?: IsoDateTimeString;
  closedAt?: IsoDateTimeString;
}

export interface CreateWorkOrderInput
  extends CreateEntityInput,
    WorkOrderLocationLinkage {
  requestedByUserId: EntityId;
  title: string;
  description: string;
  priority: WorkOrderPriority;
  status?: WorkOrderStatus;
}

export interface UpdateWorkOrderInput extends UpdateEntityInput {
  clientOrganizationId?: EntityId;
  locationId?: EntityId;
  requestedByUserId?: EntityId;
  title?: string;
  description?: string;
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  submittedAt?: IsoDateTimeString;
  approvedAt?: IsoDateTimeString;
  completedAt?: IsoDateTimeString;
  closedAt?: IsoDateTimeString;
}

export type AssignmentStatus =
  | "pending"
  | "accepted"
  | "declined"
  | "cancelled"
  | "completed";

export interface AssignmentOwnershipReference {
  workOrderId: EntityId;
  contractorOrganizationId: EntityId;
}

export interface Assignment extends AuditableEntity, AssignmentOwnershipReference {
  assignedByUserId: EntityId;
  status: AssignmentStatus;
  assignedAt: IsoDateTimeString;
  respondedAt?: IsoDateTimeString;
  completedAt?: IsoDateTimeString;
  notes?: string;
}

export interface CreateAssignmentInput
  extends CreateEntityInput,
    AssignmentOwnershipReference {
  assignedByUserId: EntityId;
  assignedAt: IsoDateTimeString;
  status?: AssignmentStatus;
  notes?: string;
}

export interface UpdateAssignmentInput extends UpdateEntityInput {
  workOrderId?: EntityId;
  contractorOrganizationId?: EntityId;
  assignedByUserId?: EntityId;
  status?: AssignmentStatus;
  assignedAt?: IsoDateTimeString;
  respondedAt?: IsoDateTimeString;
  completedAt?: IsoDateTimeString;
  notes?: string;
}
