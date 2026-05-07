import "server-only";

import type {
  CancelWorkerJobInput,
  CompleteWorkerJobInput,
  EnqueueWorkerJobInput,
  FailWorkerJobInput,
  ListWorkerJobsInput,
  WorkerJob,
  WorkerJobDetail,
  WorkerRuntimeDiagnostics,
} from "@/modules/runtime";
import {
  calculateWorkerRetrySchedule,
  DEFAULT_WORKER_RETRY_POLICY,
  WORKER_EXECUTION_OUTCOMES,
  WORKER_JOB_STATUSES,
  type WorkerExecutionResult,
  type WorkerRetryPolicy,
} from "@/modules/runtime";
import type { DomainEventService } from "@/server/services";
import { conflictError, notFoundError, validationError } from "@/server/services/errors";
import { nowIso, serviceFail, serviceOk, type ServiceAuditContext, type ServiceResult } from "@/server/services/types";
import { EVENT_VISIBILITIES } from "@/server/events/types";
import { createDeadLetterService, type DeadLetterService } from "./dead-letter-service";
import { createEventProcessingRepository } from "./event-processing-repository";
import {
  createEventSubscriberRegistry,
  type EventSubscriberRegistry as RuntimeEventSubscriberRegistry,
} from "./event-subscriber-registry";
import {
  createEventSubscriberService,
  type EventSubscriberService,
} from "./event-subscriber-service";
import { createEventToJobService } from "./event-to-job-service";
import { createRuntimeDiagnosticsService, type RuntimeDiagnosticsService } from "./runtime-diagnostics-service";
import {
  createSubscriberDiagnosticsService,
  type SubscriberDiagnosticsService,
} from "./subscriber-diagnostics-service";
import { createWorkerLeaseService, type WorkerLeaseService } from "./worker-lease-service";
import { createWorkerQueueRepository, type WorkerQueueRepository } from "./worker-queue-repository";
import type { FirestoreRepositories } from "@/server/repositories";
import type { SlaSchedulerService } from "@/modules/sla";

export interface WorkerRuntimeService {
  enqueue(
    input: ServiceAuditContext & EnqueueWorkerJobInput,
  ): Promise<ServiceResult<WorkerJob>>;
  getJob(input: {
    organizationId: string;
    jobId: string;
  }): Promise<ServiceResult<WorkerJobDetail>>;
  listJobs(input: ListWorkerJobsInput): Promise<ServiceResult<WorkerJob[]>>;
  complete(input: CompleteWorkerJobInput): Promise<ServiceResult<WorkerExecutionResult>>;
  fail(input: FailWorkerJobInput): Promise<ServiceResult<WorkerExecutionResult>>;
  cancel(input: CancelWorkerJobInput): Promise<ServiceResult<WorkerExecutionResult>>;
}

export interface RuntimeDomainServices {
  jobs: WorkerRuntimeService;
  lease: WorkerLeaseService;
  deadLetters: DeadLetterService;
  diagnostics: RuntimeDiagnosticsService;
  subscribers: EventSubscriberService;
  subscriberDiagnostics: SubscriberDiagnosticsService;
}

export function createRuntimeServices(
  repositories: Pick<
    FirestoreRepositories,
    "domainEvents" | "runtimeJobs" | "runtimeDeadLetters" | "runtimeEventProcessings"
  >,
  dependencies: {
    domainEvents: DomainEventService;
    retryPolicy?: WorkerRetryPolicy;
    subscriberRegistry?: RuntimeEventSubscriberRegistry;
    slaScheduler?: SlaSchedulerService;
  },
): RuntimeDomainServices {
  const repository = createWorkerQueueRepository(repositories);
  const eventProcessingRepository = createEventProcessingRepository(repositories);
  const deadLetters = createDeadLetterService(repository);
  const diagnostics = createRuntimeDiagnosticsService(repository, repository);
  const lease = createWorkerLeaseService(repository);
  const jobs = new FirestoreWorkerRuntimeService(
    repository,
    deadLetters,
    diagnostics,
    dependencies.domainEvents,
    dependencies.retryPolicy ?? DEFAULT_WORKER_RETRY_POLICY,
  );
  const registry = dependencies.subscriberRegistry ?? createEventSubscriberRegistry();
  const eventToJob = createEventToJobService(jobs, {
    slaScheduler: dependencies.slaScheduler,
  });
  const subscribers = createEventSubscriberService(registry, eventProcessingRepository, eventToJob);
  const subscriberDiagnostics = createSubscriberDiagnosticsService(
    eventProcessingRepository,
    registry,
  );

  return {
    jobs,
    lease,
    deadLetters,
    diagnostics,
    subscribers,
    subscriberDiagnostics,
  };
}

class FirestoreWorkerRuntimeService implements WorkerRuntimeService {
  constructor(
    private readonly repository: WorkerQueueRepository & ReturnType<typeof createWorkerQueueRepository>,
    private readonly deadLetters: DeadLetterService,
    private readonly diagnostics: RuntimeDiagnosticsService,
    private readonly domainEvents: DomainEventService,
    private readonly retryPolicy: WorkerRetryPolicy,
  ) {}

  async enqueue(
    input: ServiceAuditContext & EnqueueWorkerJobInput,
  ): Promise<ServiceResult<WorkerJob>> {
    if (!input.type.trim()) {
      return serviceFail(validationError("Worker job type is required."));
    }
    if (!input.payloadVersion.trim()) {
      return serviceFail(validationError("Worker payloadVersion is required."));
    }
    if (!input.idempotencyKey.trim()) {
      return serviceFail(validationError("Worker idempotencyKey is required."));
    }

    const existing = await this.repository.findJobByIdempotencyKey({
      organizationId: input.organizationId,
      type: input.type,
      idempotencyKey: input.idempotencyKey,
    });
    if (existing) {
      const existingPayload = JSON.stringify(existing.payload);
      const nextPayload = JSON.stringify(input.payload);
      if (existing.payloadVersion !== input.payloadVersion || existingPayload !== nextPayload) {
        return serviceFail(
          conflictError("Idempotency key is already bound to a different worker payload."),
        );
      }
      return serviceOk(existing);
    }

    const timestamp = input.now ?? nowIso();
    const job: WorkerJob = {
      id: this.repository.newJobId(),
      organizationId: input.organizationId,
      tenantId: input.organizationId,
      type: input.type,
      status: WORKER_JOB_STATUSES.Queued,
      payload: input.payload,
      payloadVersion: input.payloadVersion,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      causationId: input.causationId,
      sourceEventId: input.sourceEventId ?? null,
      attemptCount: 0,
      maxAttempts: input.maxAttempts ?? 5,
      runAfter: input.runAfter ?? timestamp,
      leasedBy: null,
      leaseExpiresAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      lastError: null,
      completedAt: null,
    };

    await this.repository.createJob(job);
    await this.recordRuntimeEvent(input, job, "runtime_job_queued", "Runtime job queued.", {
      jobId: job.id,
      jobType: job.type,
      status: job.status,
      attemptCount: job.attemptCount,
      maxAttempts: job.maxAttempts,
      runAfter: job.runAfter,
    });
    return serviceOk(job);
  }

  async getJob(input: {
    organizationId: string;
    jobId: string;
  }): Promise<ServiceResult<WorkerJobDetail>> {
    const job = await this.repository.getJobById(input.jobId);
    if (!job || job.organizationId !== input.organizationId) {
      return serviceFail(notFoundError("Worker job not found."));
    }

    const deadLetter = await this.repository.getDeadLetterByOriginalJobId(job.id);
    return serviceOk({ job, deadLetter });
  }

  async listJobs(input: ListWorkerJobsInput): Promise<ServiceResult<WorkerJob[]>> {
    const result = await this.repository.listJobsByOrganizationId(input.organizationId, input.limit ?? 100);
    const filtered = result.items
      .filter((job) => (input.status ? job.status === input.status : true))
      .filter((job) => (input.type ? job.type === input.type : true))
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    return serviceOk(filtered.slice(0, input.limit ?? filtered.length));
  }

  async complete(input: CompleteWorkerJobInput): Promise<ServiceResult<WorkerExecutionResult>> {
    const job = await this.requireOwnedJob(input.organizationId, input.jobId, input.workerId);
    if (!job.ok) {
      return job;
    }
    if (job.value.status === WORKER_JOB_STATUSES.Succeeded) {
      return serviceOk({
        outcome: WORKER_EXECUTION_OUTCOMES.NoopDuplicate,
        job: job.value,
        deadLetterRecord: null,
      });
    }

    const updated: WorkerJob = {
      ...job.value,
      status: WORKER_JOB_STATUSES.Succeeded,
      leasedBy: null,
      leaseExpiresAt: null,
      updatedAt: input.now,
      completedAt: input.now,
    };
    await this.repository.saveJob(updated);
    await this.recordRuntimeEvent(
      toSystemAuditContext(updated.organizationId, input.now),
      updated,
      "runtime_job_succeeded",
      "Runtime job completed successfully.",
      {
        jobId: updated.id,
        jobType: updated.type,
        attemptCount: updated.attemptCount,
      },
    );

    return serviceOk({
      outcome: WORKER_EXECUTION_OUTCOMES.Succeeded,
      job: updated,
      deadLetterRecord: null,
    });
  }

  async fail(input: FailWorkerJobInput): Promise<ServiceResult<WorkerExecutionResult>> {
    const existing = await this.requireOwnedJob(input.organizationId, input.jobId, input.workerId);
    if (!existing.ok) {
      return existing;
    }
    if (existing.value.status === WORKER_JOB_STATUSES.Succeeded) {
      return serviceOk({
        outcome: WORKER_EXECUTION_OUTCOMES.NoopDuplicate,
        job: existing.value,
        deadLetterRecord: null,
      });
    }

    const baseJob: WorkerJob = {
      ...existing.value,
      lastError: sanitizeWorkerError(input.error),
      updatedAt: input.now,
      leasedBy: null,
      leaseExpiresAt: null,
    };

    await this.recordRuntimeEvent(
      toSystemAuditContext(baseJob.organizationId, input.now),
      baseJob,
      "runtime_job_failed",
      "Runtime job execution failed.",
      {
        jobId: baseJob.id,
        jobType: baseJob.type,
        attemptCount: baseJob.attemptCount,
        retryable: baseJob.lastError?.retryable ?? false,
      },
    );

    if (!(baseJob.lastError?.retryable ?? false) || baseJob.attemptCount >= baseJob.maxAttempts) {
      const deadLettered: WorkerJob = {
        ...baseJob,
        status: WORKER_JOB_STATUSES.DeadLettered,
        completedAt: input.now,
      };
      await this.repository.saveJob(deadLettered);
      const routed = await this.deadLetters.routeJob({
        deadLetterId: this.repository.newDeadLetterId(),
        job: deadLettered,
        now: input.now,
        errorSummary: baseJob.lastError?.message ?? "Worker job failed.",
      });
      if (!routed.ok) {
        return routed;
      }
      await this.recordRuntimeEvent(
        toSystemAuditContext(deadLettered.organizationId, input.now),
        deadLettered,
        "runtime_job_dead_lettered",
        "Runtime job moved to dead letter.",
        {
          jobId: deadLettered.id,
          jobType: deadLettered.type,
          deadLetterRecordId: routed.value.id,
          attemptCount: deadLettered.attemptCount,
        },
      );
      return serviceOk({
        outcome: WORKER_EXECUTION_OUTCOMES.DeadLettered,
        job: deadLettered,
        deadLetterRecord: routed.value,
      });
    }

    const retry = calculateWorkerRetrySchedule({
      attemptCount: baseJob.attemptCount,
      now: input.now,
      stableKey: `${baseJob.id}:${baseJob.idempotencyKey}`,
      policy: this.retryPolicy,
    });
    const retried: WorkerJob = {
      ...baseJob,
      status: WORKER_JOB_STATUSES.Queued,
      runAfter: retry.nextRunAfter,
    };
    await this.repository.saveJob(retried);
    await this.recordRuntimeEvent(
      toSystemAuditContext(retried.organizationId, input.now),
      retried,
      "runtime_job_retry_scheduled",
      "Runtime job retry scheduled.",
      {
        jobId: retried.id,
        jobType: retried.type,
        attemptCount: retried.attemptCount,
        nextRunAfter: retried.runAfter,
        delayMs: retry.delayMs,
      },
    );
    return serviceOk({
      outcome: WORKER_EXECUTION_OUTCOMES.RetryScheduled,
      job: retried,
      deadLetterRecord: null,
    });
  }

  async cancel(input: CancelWorkerJobInput): Promise<ServiceResult<WorkerExecutionResult>> {
    const existing = await this.repository.getJobById(input.jobId);
    if (!existing || existing.organizationId !== input.organizationId) {
      return serviceFail(notFoundError("Worker job not found."));
    }
    if (existing.status === WORKER_JOB_STATUSES.Cancelled) {
      return serviceOk({
        outcome: WORKER_EXECUTION_OUTCOMES.NoopDuplicate,
        job: existing,
        deadLetterRecord: null,
      });
    }

    const cancelled: WorkerJob = {
      ...existing,
      status: WORKER_JOB_STATUSES.Cancelled,
      leasedBy: null,
      leaseExpiresAt: null,
      updatedAt: input.now,
      completedAt: input.now,
    };
    await this.repository.saveJob(cancelled);
    await this.recordRuntimeEvent(
      toSystemAuditContext(cancelled.organizationId, input.now),
      cancelled,
      "runtime_job_cancelled",
      "Runtime job cancelled.",
      {
        jobId: cancelled.id,
        jobType: cancelled.type,
      },
    );
    return serviceOk({
      outcome: WORKER_EXECUTION_OUTCOMES.Cancelled,
      job: cancelled,
      deadLetterRecord: null,
    });
  }

  private async requireOwnedJob(
    organizationId: string,
    jobId: string,
    workerId: string,
  ): Promise<ServiceResult<WorkerJob>> {
    const job = await this.repository.getJobById(jobId);
    if (!job || job.organizationId !== organizationId) {
      return serviceFail(notFoundError("Worker job not found."));
    }
    if (job.status === WORKER_JOB_STATUSES.Succeeded) {
      return serviceOk(job);
    }
    if (job.leasedBy !== workerId) {
      return serviceFail(conflictError("Worker job lease is owned by another worker."));
    }
    return serviceOk(job);
  }

  private async recordRuntimeEvent(
    audit: ServiceAuditContext,
    job: WorkerJob,
    type:
      | "runtime_job_queued"
      | "runtime_job_failed"
      | "runtime_job_retry_scheduled"
      | "runtime_job_dead_lettered"
      | "runtime_job_succeeded"
      | "runtime_job_cancelled",
    summary: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.domainEvents.record({
      ...audit,
      workOrderId: null,
      type,
      visibility: EVENT_VISIBILITIES.System,
      lifecycleStatus: null,
      entity: {
        entityType: "runtime_job",
        entityId: job.id,
        label: job.type,
      },
      summary,
      payload: {
        ...payload,
        correlationId: job.correlationId,
        causationId: job.causationId,
        sourceEventId: job.sourceEventId,
      } as never,
      correlationId: job.correlationId,
    });
  }
}

function sanitizeWorkerError(input: WorkerJob["lastError"]): WorkerJob["lastError"] {
  if (!input) {
    return null;
  }

  return {
    ...input,
    message: truncateString(input.message, 500),
    details: sanitizeObject(input.details),
  };
}

function sanitizeObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => {
      if (isSecretKey(key)) {
        return [key, "[redacted]"];
      }
      if (typeof entry === "string") {
        return [key, truncateString(entry, 500)];
      }
      if (Array.isArray(entry)) {
        return [key, entry.slice(0, 25).map((item) => (typeof item === "string" ? truncateString(item, 200) : item))];
      }
      if (entry && typeof entry === "object") {
        return [key, sanitizeObject(entry as Record<string, unknown>)];
      }
      return [key, entry];
    }),
  );
}

function isSecretKey(key: string): boolean {
  return /token|secret|password|authorization|cookie|credential/i.test(key);
}

function truncateString(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function toSystemAuditContext(organizationId: string, now: string): ServiceAuditContext {
  return {
    organizationId,
    actor: {
      userId: "system",
      role: "system",
    },
    now,
  };
}
