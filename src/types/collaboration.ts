import type {
  AuditableEntity,
  CreateEntityInput,
  EntityId,
  IsoDateTimeString,
  UpdateEntityInput,
} from "@/types/entity";
import type { VisibilityTaggedRecord } from "@/types/visibility";

export type BusinessRecordEntityType =
  | "WorkOrder"
  | "Assignment"
  | "ContractorQuote"
  | "ClientQuote"
  | "Invoice";

export interface BusinessRecordParentReference {
  parentEntityType: BusinessRecordEntityType;
  parentEntityId: EntityId;
  workOrderId: EntityId;
  clientOrganizationId?: EntityId;
  locationId?: EntityId;
  contractorOrganizationId?: EntityId;
}

export interface Comment
  extends AuditableEntity,
    VisibilityTaggedRecord,
    BusinessRecordParentReference {
  authorUserId: EntityId;
  body: string;
  editedAt?: IsoDateTimeString;
}

export interface CreateCommentInput
  extends CreateEntityInput,
    VisibilityTaggedRecord,
    BusinessRecordParentReference {
  authorUserId: EntityId;
  body: string;
}

export interface UpdateCommentInput extends UpdateEntityInput {
  parentEntityType?: BusinessRecordEntityType;
  parentEntityId?: EntityId;
  workOrderId?: EntityId;
  clientOrganizationId?: EntityId;
  locationId?: EntityId;
  contractorOrganizationId?: EntityId;
  visibility?: VisibilityTaggedRecord["visibility"];
  body?: string;
  editedAt?: IsoDateTimeString;
}

export interface Attachment
  extends AuditableEntity,
    VisibilityTaggedRecord,
    BusinessRecordParentReference {
  uploadedByUserId: EntityId;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageObjectKey: string;
  checksumSha256?: string;
}

export interface CreateAttachmentInput
  extends CreateEntityInput,
    VisibilityTaggedRecord,
    BusinessRecordParentReference {
  uploadedByUserId: EntityId;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  storageObjectKey: string;
  checksumSha256?: string;
}

export interface UpdateAttachmentInput extends UpdateEntityInput {
  parentEntityType?: BusinessRecordEntityType;
  parentEntityId?: EntityId;
  workOrderId?: EntityId;
  clientOrganizationId?: EntityId;
  locationId?: EntityId;
  contractorOrganizationId?: EntityId;
  visibility?: VisibilityTaggedRecord["visibility"];
  fileName?: string;
  contentType?: string;
  sizeBytes?: number;
  storageObjectKey?: string;
  checksumSha256?: string;
}
