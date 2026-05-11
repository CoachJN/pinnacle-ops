import "server-only";

import type { WorkerJob } from "@/modules/runtime";
import type { RuntimeDomainServices } from "@/server/services";
import type { RuntimeCapacityGuardrailService } from "@/modules/runtime-capacity";
import { serviceOk, type ServiceResult } from "@/server/services";
import {
  buildRuntimeScheduledTaskId,
  DEFAULT_RUNTIME_SCHEDULES,
  getRuntimeScheduleDefinition,
  type RuntimeScheduleDefinition,
} from "../domain/runtime-schedule";
import { SCHEDULED_TASK_STATUSES, type ScheduledTask } from "../domain/scheduled-task";
import {
  SCHEDULER_TASK_OUTCOMES,
  type RuntimeSchedulerTickResult,
  type SchedulerRunRecord,
  type SchedulerTaskTickResult,
} from "../domain/scheduler-result";
import type { SchedulerRepositories } from "./scheduler-task-repository";

export interface RuntimeSchedulerService {
  ensureCanonicalTasks(input: {
    organizationId: string;
    now: string;
  }): Promise<readonly ScheduledTask[]>;
  tick(input: {
    organizationId: string;
    workerId: string;
    now: string;
    maxTasks?: number;
    leaseDurationMs?: number;
    dryRun?: boolean;
  }): Promise<ServiceResult<RuntimeSchedulerTickResult>>;
}

export function createRuntimeSchedulerService(
  repositories: SchedulerRepositories,
  runtime: Pick<RuntimeDomainServices, "jobs">,
  capacityGuardrails?: RuntimeCapacityGuardrailService,
): RuntimeSchedulerService {
  return {
    async ensureCanonicalTasks(input) {
      const ensured: ScheduledTask[] = [];
      for (const schedule of DEFAULT_RUNTIME_SCHEDULES) {
        const existing = await repositories.tasks.findByTaskType({
          organizationId: input.organizationId,
          taskType: schedule.taskType,
        });
        if (existing) {
          ensured.push(existing);
          continue;
        }
        const created: ScheduledTask = {
          id: buildRuntimeScheduledTaskId(input.organizationId, schedule.taskType),
          organizationId: input.organizationId,
          tenantId: input.organizationId,
          taskType: schedule.taskType,
          status: SCHEDULED_TASK_STATUSES.Enabled,
          cadence: schedule.cadence,
          nextRunAt: input.now,
          lastRunAt: null,
          lastCompletedAt: null,
          lastRuntimeJobId: null,
          leaseOwner: null,
          leaseExpiresAt: null,
          failureCount: 0,
          lastError: null,
          correlationId: `scheduler:${input.organizationId}:${schedule.taskType}`,
          createdAt: input.now,
          updatedAt: input.now,
        };
        ensured.push(await repositories.tasks.create(created));
      }
      return ensured;
    },
    async tick(input) {
      await this.ensureCanonicalTasks({
        organizationId: input.organizationId,
        now: input.now,
      });

      const requestedMaxTasks = Math.max(1, Math.min(input.maxTasks ?? DEFAULT_RUNTIME_SCHEDULES.length, 20));
      const leaseDurationMs = Math.max(30_000, input.leaseDurationMs ?? 60_000);
      const schedulerBudget = capacityGuardrails
        ? await capacityGuardrails.getSchedulerBudget({
            organizationId: input.organizationId,
            tenantId: input.organizationId,
            taskType: "scheduler.tick",
            now: input.now,
            requestedTasks: requestedMaxTasks,
          })
        : { allowedMaxTasks: requestedMaxTasks, reason: null };
      const maxTasks = schedulerBudget.allowedMaxTasks;
      if (maxTasks <= 0) {
        return serviceOk({
          organizationId: input.organizationId,
          workerId: input.workerId,
          tickedAt: input.now,
          dueTaskCount: 0,
          claimedTaskCount: 0,
          enqueuedCount: 0,
          existingCount: 0,
          failedCount: 0,
          rateLimitedCount: 0,
          dryRun: Boolean(input.dryRun),
          results: [],
        });
      }
      const tasks = await repositories.tasks.claimDueTasks({
        organizationId: input.organizationId,
        now: input.now,
        workerId: input.workerId,
        leaseDurationMs,
        limit: maxTasks,
      });
      const activeJobs = await runtime.jobs.listJobs({
        organizationId: input.organizationId,
        limit: 500,
      });
      if (!activeJobs.ok) {
        return activeJobs;
      }

      const results: SchedulerTaskTickResult[] = [];
      for (const task of tasks) {
        if (capacityGuardrails) {
          const taskBudget = await capacityGuardrails.getSchedulerBudget({
            organizationId: input.organizationId,
            tenantId: input.organizationId,
            taskType: task.taskType,
            now: input.now,
            requestedTasks: 1,
          });
          if (taskBudget.allowedMaxTasks <= 0) {
            results.push({
              taskId: task.id,
              taskType: task.taskType,
              outcome: SCHEDULER_TASK_OUTCOMES.RateLimited,
              runtimeJobId: null,
              scheduledFor: task.nextRunAt,
              nextRunAt: task.nextRunAt,
              message: taskBudget.reason ?? "Scheduler task paused by runtime capacity guardrails.",
            });
            continue;
          }
        }
        const result = input.dryRun
          ? await recordDryRun(repositories, task, input.now)
          : await scheduleTask(
              repositories,
              runtime,
              activeJobs.value,
              task,
              input.workerId,
              input.now,
            );
        results.push(result);
      }

      return serviceOk({
        organizationId: input.organizationId,
        workerId: input.workerId,
        tickedAt: input.now,
        dueTaskCount: tasks.length,
        claimedTaskCount: tasks.length,
        enqueuedCount: results.filter((item) => item.outcome === "enqueued").length,
        existingCount: results.filter((item) => item.outcome === "existing").length,
        failedCount: results.filter((item) => item.outcome === "failed").length,
        rateLimitedCount: results.filter((item) => item.outcome === "rate_limited").length,
        dryRun: Boolean(input.dryRun),
        results,
      });
    },
  };
}

async function scheduleTask(
  repositories: SchedulerRepositories,
  runtime: Pick<RuntimeDomainServices, "jobs">,
  activeJobs: readonly WorkerJob[],
  task: ScheduledTask,
  workerId: string,
  now: string,
): Promise<SchedulerTaskTickResult> {
  const definition = getRuntimeScheduleDefinition(task.taskType);
  const scheduledIdempotencyKey = `scheduled:${task.id}:${task.nextRunAt}`;
  const activeOfType = activeJobs.filter(
    (job) =>
      job.type === task.taskType &&
      (job.status === "queued" || job.status === "leased" || job.status === "running"),
  ).length;
  if (activeOfType >= definition.rateLimit.maxActiveJobs) {
    return updateTaskForSkippedRun(
      repositories,
      task,
      now,
      definition,
      "rate_limited",
      `Rate limited: ${activeOfType} active runtime jobs already exist for ${task.taskType}.`,
    );
  }

  if (task.failureCount >= definition.rateLimit.circuitBreakerFailureThreshold) {
    const paused = await repositories.tasks.save({
      ...task,
      status: SCHEDULED_TASK_STATUSES.Paused,
      leaseOwner: null,
      leaseExpiresAt: null,
      lastError: "Circuit opened after repeated scheduler failures.",
      updatedAt: now,
    });
    await recordRun(repositories, paused, {
      outcome: SCHEDULER_TASK_OUTCOMES.CircuitOpen,
      runtimeJobId: null,
      message: paused.lastError ?? "Circuit open.",
      scheduledFor: task.nextRunAt,
      batchLimit: definition.batchLimit,
      now,
    });
    return {
      taskId: paused.id,
      taskType: paused.taskType,
      outcome: SCHEDULER_TASK_OUTCOMES.CircuitOpen,
      runtimeJobId: null,
      scheduledFor: task.nextRunAt,
      nextRunAt: paused.nextRunAt,
      message: paused.lastError ?? "Circuit open.",
    };
  }

  const job = await runtime.jobs.enqueue({
    organizationId: task.organizationId,
    actor: { userId: "system", role: "system" },
    now,
    type: task.taskType,
    payloadVersion: "v1",
    payload: buildRuntimeJobPayload(task, definition),
    idempotencyKey: scheduledIdempotencyKey,
    runAfter: now,
    correlationId: task.correlationId,
    causationId: `scheduler:${task.id}:${task.nextRunAt}`,
    sourceEventId: null,
    maxAttempts: 3,
  });

  if (!job.ok) {
    const failureCount = task.failureCount + 1;
    const nextRunAt = new Date(
      Date.parse(now) + definition.rateLimit.cooldownMs,
    ).toISOString();
    const updated = await repositories.tasks.save({
      ...task,
      status:
        failureCount >= definition.rateLimit.circuitBreakerFailureThreshold
          ? SCHEDULED_TASK_STATUSES.Paused
          : SCHEDULED_TASK_STATUSES.Enabled,
      failureCount,
      lastError: job.error.safeMessage,
      nextRunAt,
      leaseOwner: null,
      leaseExpiresAt: null,
      updatedAt: now,
    });
    await recordRun(repositories, updated, {
      outcome: SCHEDULER_TASK_OUTCOMES.Failed,
      runtimeJobId: null,
      message: job.error.safeMessage,
      scheduledFor: task.nextRunAt,
      batchLimit: definition.batchLimit,
      now,
    });
    return {
      taskId: updated.id,
      taskType: updated.taskType,
      outcome: SCHEDULER_TASK_OUTCOMES.Failed,
      runtimeJobId: null,
      scheduledFor: task.nextRunAt,
      nextRunAt: updated.nextRunAt,
      message: job.error.safeMessage,
    };
  }

  const updated = await repositories.tasks.save({
    ...task,
    status: SCHEDULED_TASK_STATUSES.Enabled,
    nextRunAt: new Date(Date.parse(task.nextRunAt) + task.cadence.everyMs).toISOString(),
    lastRunAt: now,
    lastCompletedAt: now,
    lastRuntimeJobId: job.value.id,
    leaseOwner: null,
    leaseExpiresAt: null,
    failureCount: 0,
    lastError: null,
    updatedAt: now,
  });
  const outcome = activeJobs.some(
    (item) => item.type === task.taskType && item.idempotencyKey === scheduledIdempotencyKey,
  )
    ? SCHEDULER_TASK_OUTCOMES.Existing
    : SCHEDULER_TASK_OUTCOMES.Enqueued;
  await recordRun(repositories, updated, {
    outcome,
    runtimeJobId: job.value.id,
    message:
      outcome === SCHEDULER_TASK_OUTCOMES.Existing
        ? "Duplicate tick reused the existing canonical runtime job."
        : "Scheduled runtime job enqueued successfully.",
    scheduledFor: task.nextRunAt,
    batchLimit: definition.batchLimit,
    now,
  });
  return {
    taskId: updated.id,
    taskType: updated.taskType,
    outcome,
    runtimeJobId: job.value.id,
    scheduledFor: task.nextRunAt,
    nextRunAt: updated.nextRunAt,
    message:
      outcome === SCHEDULER_TASK_OUTCOMES.Existing
        ? "Existing runtime job reused."
        : "Runtime job enqueued.",
  };
}

async function recordDryRun(
  repositories: SchedulerRepositories,
  task: ScheduledTask,
  now: string,
): Promise<SchedulerTaskTickResult> {
  await recordRun(repositories, task, {
    outcome: SCHEDULER_TASK_OUTCOMES.DryRun,
    runtimeJobId: null,
    message: "Dry run skipped runtime enqueue.",
    scheduledFor: task.nextRunAt,
    batchLimit: getRuntimeScheduleDefinition(task.taskType).batchLimit,
    now,
  });
  await repositories.tasks.save({
    ...task,
    leaseOwner: null,
    leaseExpiresAt: null,
    updatedAt: now,
  });
  return {
    taskId: task.id,
    taskType: task.taskType,
    outcome: SCHEDULER_TASK_OUTCOMES.DryRun,
    runtimeJobId: null,
    scheduledFor: task.nextRunAt,
    nextRunAt: task.nextRunAt,
    message: "Dry run skipped runtime enqueue.",
  };
}

async function updateTaskForSkippedRun(
  repositories: SchedulerRepositories,
  task: ScheduledTask,
  now: string,
  definition: RuntimeScheduleDefinition,
  outcome: "rate_limited",
  message: string,
): Promise<SchedulerTaskTickResult> {
  const updated = await repositories.tasks.save({
    ...task,
    nextRunAt: new Date(Date.parse(now) + definition.rateLimit.cooldownMs).toISOString(),
    lastRunAt: now,
    leaseOwner: null,
    leaseExpiresAt: null,
    lastError: message,
    updatedAt: now,
  });
  await recordRun(repositories, updated, {
    outcome: SCHEDULER_TASK_OUTCOMES.RateLimited,
    runtimeJobId: null,
    message,
    scheduledFor: task.nextRunAt,
    batchLimit: definition.batchLimit,
    now,
  });
  return {
    taskId: updated.id,
    taskType: updated.taskType,
    outcome,
    runtimeJobId: null,
    scheduledFor: task.nextRunAt,
    nextRunAt: updated.nextRunAt,
    message,
  };
}

async function recordRun(
  repositories: SchedulerRepositories,
  task: ScheduledTask,
  input: {
    outcome: SchedulerRunRecord["outcome"];
    runtimeJobId: string | null;
    message: string;
    scheduledFor: string;
    batchLimit: number;
    now: string;
  },
): Promise<void> {
  await repositories.runs.create({
    id: repositories.runs.newId(),
    organizationId: task.organizationId,
    tenantId: task.tenantId,
    taskId: task.id,
    taskType: task.taskType,
    outcome: input.outcome,
    runtimeJobId: input.runtimeJobId,
    message: input.message,
    correlationId: task.correlationId,
    causationId: `scheduler:${task.id}:${input.scheduledFor}`,
    scheduledFor: input.scheduledFor,
    batchLimit: input.batchLimit,
    createdAt: input.now,
  });
}

function buildRuntimeJobPayload(
  task: ScheduledTask,
  definition: RuntimeScheduleDefinition,
): Record<string, unknown> {
  return {
    payloadVersion: "v1",
    scheduledTaskId: task.id,
    scheduledFor: task.nextRunAt,
    batchLimit: definition.batchLimit,
    taskType: task.taskType,
  };
}
