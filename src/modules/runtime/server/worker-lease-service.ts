import "server-only";

import type {
  ClaimWorkerJobByIdInput,
  ClaimWorkerJobInput,
  ExtendWorkerLeaseInput,
  MarkWorkerJobRunningInput,
  WorkerJob,
} from "@/modules/runtime";
import { WORKER_JOB_STATUSES } from "@/modules/runtime";
import { conflictError, notFoundError } from "@/server/services/errors";
import { serviceFail, serviceOk, type ServiceResult } from "@/server/services/types";
import type { WorkerQueueRepository } from "./worker-queue-repository";

export interface WorkerLeaseService {
  claimNext(input: ClaimWorkerJobInput): Promise<ServiceResult<WorkerJob | null>>;
  claimById(input: ClaimWorkerJobByIdInput): Promise<ServiceResult<WorkerJob | null>>;
  markRunning(input: MarkWorkerJobRunningInput): Promise<ServiceResult<WorkerJob>>;
  extendLease(input: ExtendWorkerLeaseInput): Promise<ServiceResult<WorkerJob>>;
}

export function createWorkerLeaseService(repository: WorkerQueueRepository): WorkerLeaseService {
  return {
    async claimNext(input) {
      const job = await repository.claimNextJob(input);
      return serviceOk(job);
    },
    async claimById(input) {
      const job = await repository.claimJobById(input);
      return serviceOk(job);
    },
    async markRunning(input) {
      const existing = await repository.getJobById(input.jobId);
      if (!existing || existing.organizationId !== input.organizationId) {
        return serviceFail(notFoundError("Worker job not found."));
      }
      if (existing.leasedBy !== input.workerId || existing.lease.claimToken !== input.claimToken) {
        return serviceFail(conflictError("Worker job lease is owned by another worker."));
      }
      if (
        existing.status !== WORKER_JOB_STATUSES.Leased &&
        existing.status !== WORKER_JOB_STATUSES.Running
      ) {
        return serviceFail(conflictError("Only leased jobs can transition to running."));
      }
      const updated = await repository.mutateWithActiveLease({
        organizationId: input.organizationId,
        jobId: input.jobId,
        workerId: input.workerId,
        claimToken: input.claimToken,
        now: input.now,
        mutate: (job) => ({
          ...job,
          status: WORKER_JOB_STATUSES.Running,
          updatedAt: input.now,
          lease: {
            ...job.lease,
            heartbeatAt: input.now,
          },
        }),
      });
      if (!updated) {
        return serviceFail(
          conflictError("Worker job lease changed or expired before it could transition to running."),
        );
      }
      return serviceOk(updated);
    },
    async extendLease(input) {
      const existing = await repository.getJobById(input.jobId);
      if (!existing || existing.organizationId !== input.organizationId) {
        return serviceFail(notFoundError("Worker job not found."));
      }
      if (existing.leasedBy !== input.workerId || existing.lease.claimToken !== input.claimToken) {
        return serviceFail(conflictError("Worker job lease is owned by another worker."));
      }
      if (
        existing.status !== WORKER_JOB_STATUSES.Leased &&
        existing.status !== WORKER_JOB_STATUSES.Running
      ) {
        return serviceFail(conflictError("Only leased jobs can extend their lease."));
      }
      const nextLeaseExpiry = new Date(Date.parse(input.now) + input.leaseDurationMs).toISOString();
      const updated = await repository.mutateWithActiveLease({
        organizationId: input.organizationId,
        jobId: input.jobId,
        workerId: input.workerId,
        claimToken: input.claimToken,
        now: input.now,
        mutate: (job) => ({
          ...job,
          leaseExpiresAt: nextLeaseExpiry,
          updatedAt: input.now,
          lease: {
            ...job.lease,
            leaseExpiresAt: nextLeaseExpiry,
            heartbeatAt: input.now,
          },
        }),
      });
      if (!updated) {
        return serviceFail(
          conflictError("Worker job lease changed or expired before it could be extended."),
        );
      }
      return serviceOk(updated);
    },
  };
}
