import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { RuntimeScheduledTaskType } from "./runtime-schedule";
import type { ScheduledTask } from "./scheduled-task";
import type { RepairConfirmation } from "./operator-guardrail";

export const SCHEDULER_TASK_OUTCOMES = {
  Enqueued: "enqueued",
  Existing: "existing",
  RateLimited: "rate_limited",
  CircuitOpen: "circuit_open",
  Failed: "failed",
  DryRun: "dry_run",
} as const;

export type SchedulerTaskOutcome =
  (typeof SCHEDULER_TASK_OUTCOMES)[keyof typeof SCHEDULER_TASK_OUTCOMES];

export interface SchedulerRunRecord {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  taskId: EntityId;
  taskType: RuntimeScheduledTaskType;
  outcome: SchedulerTaskOutcome;
  runtimeJobId: EntityId | null;
  message: string;
  correlationId: string;
  causationId: string;
  scheduledFor: IsoDateTimeString;
  batchLimit: number;
  createdAt: IsoDateTimeString;
}

export interface SchedulerTaskTickResult {
  taskId: EntityId;
  taskType: RuntimeScheduledTaskType;
  outcome: SchedulerTaskOutcome;
  runtimeJobId: EntityId | null;
  scheduledFor: IsoDateTimeString;
  nextRunAt: IsoDateTimeString;
  message: string;
}

export interface RuntimeSchedulerTickResult {
  organizationId: EntityId;
  workerId: string;
  tickedAt: IsoDateTimeString;
  dueTaskCount: number;
  claimedTaskCount: number;
  enqueuedCount: number;
  existingCount: number;
  failedCount: number;
  rateLimitedCount: number;
  dryRun: boolean;
  results: readonly SchedulerTaskTickResult[];
}

export interface RuntimeSchedulerDiagnostics {
  tasks: readonly ScheduledTask[];
  recentRuns: readonly SchedulerRunRecord[];
  pendingConfirmations: readonly RepairConfirmation[];
}
