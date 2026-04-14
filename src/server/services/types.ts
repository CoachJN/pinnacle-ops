import "server-only";

import type { AppError } from "@/lib/errors/app-error";
import type { EntityId, IsoDateTimeString, RecordStatus } from "@/types/entity";
import type { UserRole } from "@/types/permissions";

export type ServiceResult<TValue> =
  | { ok: true; value: TValue }
  | { ok: false; error: AppError };

export interface ServiceActor {
  userId: EntityId;
  role: UserRole | "system";
}

export interface ServiceAuditContext {
  organizationId: EntityId;
  actor: ServiceActor;
  now?: IsoDateTimeString;
  requestId?: string;
}

export interface ServiceAuditFields {
  organizationId: EntityId;
  recordStatus: RecordStatus;
  isDeleted: boolean;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  createdByUserId: EntityId;
  updatedByUserId: EntityId;
  deletedAt: IsoDateTimeString | null;
  deletedByUserId: EntityId | null;
}

export interface DomainServiceOptions<TRepositories> {
  repositories: TRepositories;
}

export function serviceOk<TValue>(value: TValue): ServiceResult<TValue> {
  return { ok: true, value };
}

export function serviceFail<TValue = never>(error: AppError): ServiceResult<TValue> {
  return { ok: false, error };
}

export function nowIso(): IsoDateTimeString {
  return new Date().toISOString();
}

export function createAuditFields(context: ServiceAuditContext): ServiceAuditFields {
  const timestamp = context.now ?? nowIso();
  return {
    organizationId: context.organizationId,
    recordStatus: "active",
    isDeleted: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    createdByUserId: context.actor.userId,
    updatedByUserId: context.actor.userId,
    deletedAt: null,
    deletedByUserId: null,
  };
}

export function touchAuditFields<T extends { updatedAt: IsoDateTimeString; updatedByUserId: EntityId }>(
  entity: T,
  context: ServiceAuditContext,
): T {
  return {
    ...entity,
    updatedAt: context.now ?? nowIso(),
    updatedByUserId: context.actor.userId,
  };
}
