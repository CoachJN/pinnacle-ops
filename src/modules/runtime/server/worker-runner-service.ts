import "server-only";

import type {
  RuntimeOperatorDiagnostics,
  WorkerExecutionOutcome,
  WorkerHandlerResult,
  WorkerJob,
  WorkerJobErrorState,
  WorkerRunnerBatchResult,
  WorkerRunnerEligibleJob,
  WorkerRunnerJobExecution,
} from "@/modules/runtime";
import {
  WORKER_EXECUTION_OUTCOMES,
  WORKER_JOB_STATUSES,
} from "@/modules/runtime";
import { serviceFail, serviceOk, type ServiceResult } from "@/server/services";
import { validationError } from "@/server/services/errors";
import { nowIso } from "@/server/services/types";
import type { RuntimeCapacityGuardrailService } from "@/modules/runtime-capacity";
import type { WorkerHandlerRegistry } from "./worker-handler-registry";
import type { RuntimeDomainServices } from "./worker-runtime-service";

export interface WorkerRunnerService<TServices = unknown> {
  getDiagnostics(input: {
    organizationId: string;
    limit?: number;
  }): Promise<ServiceResult<RuntimeOperatorDiagnostics>>;
  processPending(input: {
    organizationId: string;
    services: TServices;
    workerId: string;
    now?: string;
    maxJobs?: number;
    leaseDurationMs?: number;
    heartbeatIntervalMs?: number | null;
    jobTypes?: readonly string[];
    dryRun?: boolean;
  }): Promise<ServiceResult<WorkerRunnerBatchResult>>;
}

export function createWorkerRunnerService<TServices = unknown>(
  runtime: Pick<RuntimeDomainServices, "jobs" | "lease">,
  registry: WorkerHandlerRegistry<TServices>,
  capacityGuardrails?: RuntimeCapacityGuardrailService,
): WorkerRunnerService<TServices> {
  return {
    async getDiagnostics(input) {
      const eligibleJobs = await listEligibleJobs(
        runtime,
        registry,
        input.organizationId,
        input.limit ?? 25,
        nowIso(),
      );
      return serviceOk({
        registeredHandlers: registry.list(),
        eligibleJobs,
      });
    },

    async processPending(input) {
      const requestedMaxJobs = Math.max(1, input.maxJobs ?? 1);
      const timestamp = input.now ?? nowIso();
      const claimBudget = capacityGuardrails
        ? await capacityGuardrails.getClaimBudget({
            organizationId: input.organizationId,
            tenantId: input.organizationId,
            now: timestamp,
            requestedJobs: requestedMaxJobs,
          })
        : { allowedMaxJobs: requestedMaxJobs, reason: null };
      const maxJobs = claimBudget.allowedMaxJobs;

      if (input.dryRun) {
        const eligibleJobs = await listEligibleJobs(
          runtime,
          registry,
          input.organizationId,
          requestedMaxJobs,
          timestamp,
        );
        return serviceOk({
          workerId: input.workerId,
          processedCount: 0,
          completedCount: 0,
          retryScheduledCount: 0,
          deadLetteredCount: 0,
          duplicateCount: 0,
          dryRun: true,
          eligibleJobs,
          executions: [],
        });
      }

      if (maxJobs <= 0) {
        const eligibleJobs = await listEligibleJobs(
          runtime,
          registry,
          input.organizationId,
          requestedMaxJobs,
          timestamp,
        );
        return serviceOk({
          workerId: input.workerId,
          processedCount: 0,
          completedCount: 0,
          retryScheduledCount: 0,
          deadLetteredCount: 0,
          duplicateCount: 0,
          dryRun: false,
          eligibleJobs,
          executions: [],
        });
      }

      const executions: WorkerRunnerJobExecution[] = [];

      for (let index = 0; index < maxJobs; index += 1) {
        const claimed = await runtime.lease.claimNext({
          organizationId: input.organizationId,
          workerId: input.workerId,
          leaseDurationMs: input.leaseDurationMs ?? 60_000,
          now: index === 0 ? timestamp : nowIso(),
          jobTypes: input.jobTypes,
        });
        if (!claimed.ok) {
          return serviceFail(claimed.error);
        }
        if (!claimed.value) {
          break;
        }

        const execution = await executeClaimedJob({
          job: claimed.value,
          runtime,
          registry,
          services: input.services,
          workerId: input.workerId,
          leaseDurationMs: input.leaseDurationMs ?? 60_000,
          heartbeatIntervalMs: input.heartbeatIntervalMs ?? null,
        });
        executions.push(execution);
      }

      const eligibleJobs = await listEligibleJobs(
        runtime,
        registry,
        input.organizationId,
        maxJobs,
        timestamp,
      );

      return serviceOk({
        workerId: input.workerId,
        processedCount: executions.length,
        completedCount: executions.filter((item) => item.outcome === WORKER_EXECUTION_OUTCOMES.Succeeded).length,
        retryScheduledCount: executions.filter(
          (item) => item.outcome === WORKER_EXECUTION_OUTCOMES.RetryScheduled,
        ).length,
        deadLetteredCount: executions.filter(
          (item) => item.outcome === WORKER_EXECUTION_OUTCOMES.DeadLettered,
        ).length,
        duplicateCount: executions.filter(
          (item) => item.outcome === WORKER_EXECUTION_OUTCOMES.NoopDuplicate,
        ).length,
        dryRun: false,
        eligibleJobs,
        executions,
      });
    },
  };
}

async function executeClaimedJob<TServices>(input: {
  job: WorkerJob;
  runtime: Pick<RuntimeDomainServices, "jobs" | "lease">;
  registry: WorkerHandlerRegistry<TServices>;
  services: TServices;
  workerId: string;
  leaseDurationMs: number;
  heartbeatIntervalMs: number | null;
}): Promise<WorkerRunnerJobExecution> {
  let executionTimestamp = input.job.lease.claimedAt ?? nowIso();
  const markRunningAt = executionTimestamp;
  const running = await input.runtime.lease.markRunning({
    organizationId: input.job.organizationId,
    jobId: input.job.id,
    workerId: input.workerId,
    claimToken: input.job.lease.claimToken ?? "",
    now: markRunningAt,
  });
  if (!running.ok) {
    return {
      jobId: input.job.id,
      jobType: input.job.type,
      attemptCount: input.job.attemptCount,
      outcome: WORKER_EXECUTION_OUTCOMES.RetryScheduled,
      handlerRegistered: false,
      message: running.error.safeMessage,
      retryable: true,
      error: {
        code: running.error.code,
        message: running.error.safeMessage,
        retryable: true,
        occurredAt: markRunningAt,
        details: {},
      },
    };
  }

  const handler = input.registry.get(running.value.type);
  const heartbeat = {
    extendLease: async (heartbeatInput?: {
      now?: string;
      leaseDurationMs?: number;
    }) => {
      const extended = await input.runtime.lease.extendLease({
        organizationId: running.value.organizationId,
        jobId: running.value.id,
        workerId: input.workerId,
        claimToken: running.value.lease.claimToken ?? "",
        now: heartbeatInput?.now ?? executionTimestamp,
        leaseDurationMs: heartbeatInput?.leaseDurationMs ?? input.leaseDurationMs,
      });
      if (!extended.ok) {
        throw extended.error;
      }
      executionTimestamp = extended.value.lease.heartbeatAt ?? extended.value.updatedAt;
      return extended.value;
    },
  };

  let heartbeatTimer: NodeJS.Timeout | null = null;
  if (input.heartbeatIntervalMs && input.heartbeatIntervalMs > 0) {
    heartbeatTimer = setInterval(() => {
      void heartbeat.extendLease().catch(() => undefined);
    }, input.heartbeatIntervalMs);
  }

  try {
    if (!handler) {
      const failure = await input.runtime.jobs.fail({
        organizationId: running.value.organizationId,
        jobId: running.value.id,
        workerId: input.workerId,
        claimToken: running.value.lease.claimToken ?? "",
        now: executionTimestamp,
        error: {
          code: "unknown_job_type",
          message: `No worker handler is registered for job type ${running.value.type}.`,
          retryable: true,
          occurredAt: executionTimestamp,
          details: {
            jobType: running.value.type,
          },
        },
      });
      if (!failure.ok) {
        return toInternalFailureExecution(running.value, failure.error.safeMessage);
      }
      return toExecutionResult(
        running.value,
        failure.value.outcome,
        false,
        `No worker handler is registered for job type ${running.value.type}.`,
        true,
        failure.value.job.lastError,
      );
    }

    const result = await handler.handle({
      job: running.value,
      payload: running.value.payload,
      organizationId: running.value.organizationId,
      correlationId: running.value.correlationId,
      causationId: running.value.causationId,
      sourceEventId: running.value.sourceEventId,
      attemptCount: running.value.attemptCount,
      workerId: input.workerId,
      startedAt: markRunningAt,
      services: input.services,
      heartbeat,
    });

    if (result.success) {
      const completed = await input.runtime.jobs.complete({
        organizationId: running.value.organizationId,
        jobId: running.value.id,
        workerId: input.workerId,
        claimToken: running.value.lease.claimToken ?? "",
        now: executionTimestamp,
      });
      if (!completed.ok) {
        return toInternalFailureExecution(running.value, completed.error.safeMessage);
      }
      return toExecutionResult(
        running.value,
        completed.value.outcome,
        true,
        result.message ?? null,
        null,
        null,
      );
    }

    const failed = await input.runtime.jobs.fail({
      organizationId: running.value.organizationId,
      jobId: running.value.id,
      workerId: input.workerId,
      claimToken: running.value.lease.claimToken ?? "",
      now: executionTimestamp,
      error: toHandlerFailureState(result, running.value),
    });
    if (!failed.ok) {
      return toInternalFailureExecution(running.value, failed.error.safeMessage);
    }
    return toExecutionResult(
      running.value,
      failed.value.outcome,
      true,
      result.message ?? "Worker handler reported failure.",
      result.retryable ?? false,
      failed.value.job.lastError,
    );
  } catch (error) {
    const failureState = toThrownFailureState(error);
    const failed = await input.runtime.jobs.fail({
      organizationId: running.value.organizationId,
      jobId: running.value.id,
      workerId: input.workerId,
      claimToken: running.value.lease.claimToken ?? "",
      now: failureState.occurredAt,
      error: failureState,
    });
    if (!failed.ok) {
      return toInternalFailureExecution(running.value, failed.error.safeMessage);
    }
    return toExecutionResult(
      running.value,
      failed.value.outcome,
      Boolean(handler),
      failureState.message,
      failureState.retryable,
      failed.value.job.lastError,
    );
  } finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
  }
}

async function listEligibleJobs<TServices>(
  runtime: Pick<RuntimeDomainServices, "jobs">,
  registry: WorkerHandlerRegistry<TServices>,
  organizationId: string,
  limit: number,
  currentTime: string,
): Promise<WorkerRunnerEligibleJob[]> {
  const jobs = await runtime.jobs.listJobs({
    organizationId,
    limit: Math.max(limit * 4, 100),
  });
  if (!jobs.ok) {
    return [];
  }

  return jobs.value
    .filter((job) => {
      if (job.status === WORKER_JOB_STATUSES.Queued) {
        return job.runAfter <= currentTime;
      }
      if (
        (job.status === WORKER_JOB_STATUSES.Leased || job.status === WORKER_JOB_STATUSES.Running) &&
        job.leaseExpiresAt
      ) {
        return job.leaseExpiresAt <= currentTime;
      }
      return false;
    })
    .sort((left, right) => {
      const leftTime =
        left.status === WORKER_JOB_STATUSES.Queued
          ? left.runAfter
          : left.leaseExpiresAt ?? left.updatedAt;
      const rightTime =
        right.status === WORKER_JOB_STATUSES.Queued
          ? right.runAfter
          : right.leaseExpiresAt ?? right.updatedAt;
      return leftTime.localeCompare(rightTime);
    })
    .slice(0, limit)
    .map((job) => ({
      jobId: job.id,
      type: job.type,
      status: job.status,
      runAfter: job.runAfter,
      leaseExpiresAt: job.leaseExpiresAt,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
      handlerRegistered: registry.get(job.type) !== null,
    }));
}

function toHandlerFailureState(
  result: WorkerHandlerResult,
  job: WorkerJob,
): WorkerJobErrorState {
  return {
    code: result.errorCode ?? "handler_failed",
    message: result.message ?? `Worker handler failed for ${job.type}.`,
    retryable: result.retryable ?? false,
    occurredAt: nowIso(),
    details: result.errorDetails ?? result.metadata ?? {},
  };
}

function toThrownFailureState(error: unknown): WorkerJobErrorState {
  const occurredAt = nowIso();

  if (typeof error === "object" && error !== null) {
    const value = error as {
      code?: unknown;
      safeMessage?: unknown;
      message?: unknown;
      retryable?: unknown;
      details?: unknown;
    };
    return {
      code: typeof value.code === "string" ? value.code : "handler_exception",
      message:
        typeof value.safeMessage === "string"
          ? value.safeMessage
          : typeof value.message === "string"
            ? value.message
            : "Worker handler threw an unexpected error.",
      retryable: typeof value.retryable === "boolean" ? value.retryable : true,
      occurredAt,
      details: isPlainRecord(value.details) ? value.details : {},
    };
  }

  return {
    code: "handler_exception",
    message: typeof error === "string" ? error : "Worker handler threw an unexpected error.",
    retryable: true,
    occurredAt,
    details: {},
  };
}

function toExecutionResult(
  job: WorkerJob,
  outcome: WorkerExecutionOutcome,
  handlerRegistered: boolean,
  message: string | null,
  retryable: boolean | null,
  error: WorkerJobErrorState | null,
): WorkerRunnerJobExecution {
  return {
    jobId: job.id,
    jobType: job.type,
    attemptCount: job.attemptCount,
    outcome,
    handlerRegistered,
    message,
    retryable,
    error,
  };
}

function toInternalFailureExecution(
  job: WorkerJob,
  message: string,
): WorkerRunnerJobExecution {
  return {
    jobId: job.id,
    jobType: job.type,
    attemptCount: job.attemptCount,
    outcome: WORKER_EXECUTION_OUTCOMES.RetryScheduled,
    handlerRegistered: true,
    message,
    retryable: true,
    error: {
      code: "runner_internal_error",
      message,
      retryable: true,
      occurredAt: nowIso(),
      details: {},
    },
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function assertReplayablePayload(
  payload: Record<string, unknown> | null,
): asserts payload is Record<string, unknown> {
  if (!payload) {
    throw validationError("Replayable worker payload snapshot is required.");
  }
}
