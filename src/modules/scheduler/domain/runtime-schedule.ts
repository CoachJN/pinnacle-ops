import type { EntityId } from "@/types/entity";

export const RUNTIME_SCHEDULED_TASK_TYPES = {
  ProjectionRefresh: "operations.projection.refresh",
  SlaScanOverdue: "sla.scan.overdue",
  ProviderReconciliationSweep: "provider.reconciliation.sweep",
  RuntimeHealthRefresh: "runtime.health.refresh",
} as const;

export type RuntimeScheduledTaskType =
  (typeof RUNTIME_SCHEDULED_TASK_TYPES)[keyof typeof RUNTIME_SCHEDULED_TASK_TYPES];

export interface RuntimeScheduleCadence {
  everyMs: number;
}

export interface RuntimeScheduleRateLimit {
  maxActiveJobs: number;
  cooldownMs: number;
  circuitBreakerFailureThreshold: number;
}

export interface RuntimeScheduleDefinition {
  taskType: RuntimeScheduledTaskType;
  description: string;
  cadence: RuntimeScheduleCadence;
  batchLimit: number;
  leaseDurationMs: number;
  rateLimit: RuntimeScheduleRateLimit;
}

export const DEFAULT_RUNTIME_SCHEDULES: readonly RuntimeScheduleDefinition[] = [
  {
    taskType: RUNTIME_SCHEDULED_TASK_TYPES.ProjectionRefresh,
    description: "Refreshes canonical runtime command-center projections.",
    cadence: { everyMs: 5 * 60 * 1000 },
    batchLimit: 1,
    leaseDurationMs: 60_000,
    rateLimit: {
      maxActiveJobs: 1,
      cooldownMs: 5 * 60 * 1000,
      circuitBreakerFailureThreshold: 3,
    },
  },
  {
    taskType: RUNTIME_SCHEDULED_TASK_TYPES.SlaScanOverdue,
    description: "Scans overdue SLA timers and enqueues bounded evaluation jobs.",
    cadence: { everyMs: 5 * 60 * 1000 },
    batchLimit: 100,
    leaseDurationMs: 60_000,
    rateLimit: {
      maxActiveJobs: 2,
      cooldownMs: 5 * 60 * 1000,
      circuitBreakerFailureThreshold: 3,
    },
  },
  {
    taskType: RUNTIME_SCHEDULED_TASK_TYPES.ProviderReconciliationSweep,
    description: "Scans unresolved provider receipts and enqueues reconciliation jobs.",
    cadence: { everyMs: 10 * 60 * 1000 },
    batchLimit: 50,
    leaseDurationMs: 60_000,
    rateLimit: {
      maxActiveJobs: 2,
      cooldownMs: 10 * 60 * 1000,
      circuitBreakerFailureThreshold: 3,
    },
  },
  {
    taskType: RUNTIME_SCHEDULED_TASK_TYPES.RuntimeHealthRefresh,
    description: "Refreshes runtime health aggregation and alert state.",
    cadence: { everyMs: 5 * 60 * 1000 },
    batchLimit: 1,
    leaseDurationMs: 60_000,
    rateLimit: {
      maxActiveJobs: 1,
      cooldownMs: 5 * 60 * 1000,
      circuitBreakerFailureThreshold: 3,
    },
  },
] as const;

export function getRuntimeScheduleDefinition(
  taskType: RuntimeScheduledTaskType,
): RuntimeScheduleDefinition {
  const definition = DEFAULT_RUNTIME_SCHEDULES.find((item) => item.taskType === taskType);
  if (!definition) {
    throw new Error(`Unsupported runtime schedule task type: ${taskType}`);
  }
  return definition;
}

export function buildRuntimeScheduledTaskId(
  organizationId: EntityId,
  taskType: RuntimeScheduledTaskType,
): EntityId {
  return `runtime-scheduled-task:${organizationId}:${taskType}`;
}
