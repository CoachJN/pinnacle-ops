import type { EntityId, IsoDateTimeString } from "../../../types/entity.ts";

import type {
  AssignmentAssigneeType,
  AssignmentStatus,
  WorkOrderCategory,
  WorkOrderPriority,
  WorkOrderSource,
  WorkOrderStatus,
} from "./constants.ts";

export interface WorkOrder {
  id: EntityId;
  workOrderNumber: string;
  title: string;
  description: string;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  category: WorkOrderCategory;
  requestedByName: string;
  requestedByEmail: string | null;
  requestedByPhone: string | null;
  source: WorkOrderSource;
  createdByUserId: EntityId;
  assignedCoordinatorUserId: EntityId | null;
  assignedManagerUserId: EntityId | null;
  dueDate: IsoDateTimeString | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  closedAt: IsoDateTimeString | null;
  isArchived: boolean;
  searchText: string;
}

export interface WorkOrderNote {
  id: EntityId;
  workOrderId: EntityId;
  body: string;
  createdByUserId: EntityId;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface WorkOrderAttachment {
  id: EntityId;
  workOrderId: EntityId;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedBy: EntityId;
  createdAt: IsoDateTimeString;
}

export interface Assignment {
  id: EntityId;
  workOrderId: EntityId;
  assigneeType: AssignmentAssigneeType;
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
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface CreateAssignmentDto {
  workOrderId: EntityId;
  assigneeType: AssignmentAssigneeType;
  assigneeUserId: EntityId;
  scheduledDate?: IsoDateTimeString | null;
  timeWindowStart?: IsoDateTimeString | null;
  timeWindowEnd?: IsoDateTimeString | null;
  notes?: string | null;
}

export interface ReassignAssignmentDto extends CreateAssignmentDto {
  currentAssignmentId: EntityId;
}

export interface CreateContractorAssignmentDto {
  contractorOrganizationId: EntityId;
  scheduledDate?: IsoDateTimeString | null;
  timeWindowStart?: IsoDateTimeString | null;
  timeWindowEnd?: IsoDateTimeString | null;
  notes?: string | null;
}

export interface ReassignContractorAssignmentDto
  extends CreateContractorAssignmentDto {
  currentAssignmentId: EntityId;
}

export interface AcceptAssignmentDto {
  assignmentId: EntityId;
}

export interface DeclineAssignmentDto {
  assignmentId: EntityId;
  notes?: string | null;
}

export interface CompleteAssignmentDto {
  assignmentId: EntityId;
  notes?: string | null;
}

export interface WorkOrderStatusTransitionWithAssignmentDto {
  status: WorkOrderStatus;
}

export interface WorkOrderActionAvailability {
  canUpdateStatus: boolean;
  canAddNote: boolean;
  canAddAttachment: boolean;
  canAssign: boolean;
  canReassign: boolean;
  canAcceptAssignment: boolean;
  canDeclineAssignment: boolean;
  canCompleteAssignment: boolean;
}

export interface WorkOrderListItem {
  id: EntityId;
  workOrderNumber: string;
  title: string;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  status: WorkOrderStatus;
  priority: WorkOrderPriority;
  category: WorkOrderCategory;
  source: WorkOrderSource;
  requestedByName: string;
  assignedCoordinatorUserId: EntityId | null;
  assignedManagerUserId: EntityId | null;
  dueDate: IsoDateTimeString | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  closedAt: IsoDateTimeString | null;
  isArchived: boolean;
}

export interface WorkOrderDetail extends WorkOrder {
  notes: WorkOrderNote[];
  attachments: WorkOrderAttachment[];
  assignments: Assignment[];
  activeAssignment: Assignment | null;
}

export interface CreateWorkOrderDto {
  title: string;
  description: string;
  clientOrganizationId: EntityId;
  locationId: EntityId;
  priority: WorkOrderPriority;
  category: WorkOrderCategory;
  requestedByName: string;
  requestedByEmail?: string;
  requestedByPhone?: string;
  source: WorkOrderSource;
  createdByUserId: EntityId;
  assignedCoordinatorUserId?: EntityId;
  assignedManagerUserId?: EntityId;
  dueDate?: IsoDateTimeString;
  status?: WorkOrderStatus;
}

export interface UpdateWorkOrderStatusDto {
  status: WorkOrderStatus;
}

export interface CreateWorkOrderNoteDto {
  body: string;
  createdByUserId: EntityId;
}

export interface CreateWorkOrderAttachmentMetadataDto {
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storagePath: string;
  uploadedBy: EntityId;
}

export interface WorkOrderListQuery {
  status?: WorkOrderStatus;
  priority?: WorkOrderPriority;
  category?: WorkOrderCategory;
  source?: WorkOrderSource;
  clientOrganizationId?: EntityId;
  locationId?: EntityId;
  assignedCoordinatorUserId?: EntityId;
  assignedManagerUserId?: EntityId;
  requestedByEmail?: string;
  dueDateFrom?: IsoDateTimeString;
  dueDateTo?: IsoDateTimeString;
  search?: string;
  isArchived?: boolean;
  limit?: number;
  cursor?: string;
}

export interface WorkOrderListQueryDto extends WorkOrderListQuery {}
