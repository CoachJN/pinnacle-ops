import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { RuntimeScheduleCadence, RuntimeScheduledTaskType } from "./runtime-schedule";

export const SCHEDULED_TASK_STATUSES = {
  Enabled: "enabled",
  Disabled: "disabled",
  Paused: "paused",
  Failed: "failed",
} as const;

export type ScheduledTaskStatus =
  (typeof SCHEDULED_TASK_STATUSES)[keyof typeof SCHEDULED_TASK_STATUSES];

export interface ScheduledTask {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  taskType: RuntimeScheduledTaskType;
  status: ScheduledTaskStatus;
  cadence: RuntimeScheduleCadence;
  nextRunAt: IsoDateTimeString;
  lastRunAt: IsoDateTimeString | null;
  lastCompletedAt: IsoDateTimeString | null;
  lastRuntimeJobId: EntityId | null;
  leaseOwner: string | null;
  leaseExpiresAt: IsoDateTimeString | null;
  failureCount: number;
  lastError: string | null;
  correlationId: string;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}
