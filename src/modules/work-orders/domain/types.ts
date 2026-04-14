import type { EntityId, IsoDateTimeString } from "@/types/entity";

import type {
  WorkOrderCategory,
  WorkOrderPriority,
  WorkOrderSource,
  WorkOrderStatus,
} from "./constants";

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
  fileSizeBytes: number;
  storagePath: string;
  uploadedByUserId: EntityId;
  createdAt: IsoDateTimeString;
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
