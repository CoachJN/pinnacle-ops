export type EntityId = string;
export type IsoDateTimeString = string;

export type RecordStatus = "active" | "archived";

export interface EntityIdentityFields {
  id: EntityId;
  organizationId: EntityId;
}

export interface EntityAuditFields {
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  createdByUserId: EntityId;
  updatedByUserId: EntityId;
}

export interface EntityLifecycleFields {
  recordStatus: RecordStatus;
  isDeleted: boolean;
  deletedAt?: IsoDateTimeString;
  deletedByUserId?: EntityId;
}

export interface BaseEntity
  extends EntityIdentityFields,
    EntityAuditFields,
    EntityLifecycleFields {}

export type AuditableEntity = BaseEntity;

export interface OrganizationScopedReference {
  organizationId: EntityId;
}

export interface CreateEntityInput extends OrganizationScopedReference {
  createdByUserId: EntityId;
}

export interface UpdateEntityInput extends EntityIdentityFields {
  updatedByUserId: EntityId;
}
