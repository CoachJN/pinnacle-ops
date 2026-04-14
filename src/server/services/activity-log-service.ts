import "server-only";

import type {
  ActivityLog,
  ActivityLogRepository,
  FirestoreRepositories,
} from "@/server/repositories";
import type { EntityId } from "@/types/entity";
import type { UserRole } from "@/types/permissions";
import { serviceOk, type ServiceAuditContext, type ServiceResult } from "./types.ts";
import { createAuditFields, nowIso } from "./types.ts";

export type ActivityEntityType = ActivityLog["entityType"];
export type ActivityVisibility = ActivityLog["visibility"];

export interface ActivityLogService {
  listForWorkOrder(workOrderId: EntityId): Promise<ServiceResult<ActivityLog[]>>;
  record(input: RecordActivityLogInput): Promise<ServiceResult<ActivityLog>>;
}

export interface RecordActivityLogInput extends ServiceAuditContext {
  workOrderId: EntityId;
  action: string;
  eventType: string;
  message: string;
  entityType: ActivityEntityType;
  entityId: EntityId;
  entityLabel?: string | null;
  visibility?: ActivityVisibility;
  changes?: Array<{
    field: string;
    from?: unknown;
    to?: unknown;
  }>;
  metadata?: Record<string, unknown>;
}

export function createActivityLogService(
  repositories: Pick<FirestoreRepositories, "activityLogs">,
): ActivityLogService {
  return new FirestoreActivityLogService(repositories.activityLogs);
}

class FirestoreActivityLogService implements ActivityLogService {
  private readonly activityLogs: ActivityLogRepository;

  constructor(activityLogs: ActivityLogRepository) {
    this.activityLogs = activityLogs;
  }

  async listForWorkOrder(
    workOrderId: EntityId,
  ): Promise<ServiceResult<ActivityLog[]>> {
    const result = await this.activityLogs.listByWorkOrderId(workOrderId);
    return serviceOk(result.items);
  }

  async record(input: RecordActivityLogInput): Promise<ServiceResult<ActivityLog>> {
    const timestamp = input.now ?? nowIso();
    const actorType = input.actor.role === "system" ? "system" : "user";
    const activityLog: ActivityLog = {
      id: this.activityLogs.newId(),
      ...createAuditFields({ ...input, now: timestamp }),
      workOrderId: input.workOrderId,
      action: input.action,
      eventType: input.eventType,
      message: input.message,
      actorType,
      actorUserId: actorType === "system" ? null : input.actor.userId,
      actorRole: input.actor.role as UserRole | "system",
      actor: {
        type: actorType,
        userId: actorType === "system" ? null : input.actor.userId,
        role: input.actor.role as UserRole | "system",
      },
      resourceType: input.entityType,
      resourceId: input.entityId,
      resourceLabel: input.entityLabel ?? null,
      resource: {
        type: input.entityType,
        id: input.entityId,
        label: input.entityLabel ?? null,
        workOrderId: input.workOrderId,
      },
      entityType: input.entityType,
      entityId: input.entityId,
      occurredAt: timestamp,
      requestId: input.requestId ?? null,
      visibility: input.visibility ?? "internal",
      changes: input.changes ?? [],
      metadata: input.metadata ?? {},
    };

    await this.activityLogs.create(activityLog);
    return serviceOk(activityLog);
  }
}
