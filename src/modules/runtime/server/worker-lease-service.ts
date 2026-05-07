import "server-only";

import type { ClaimWorkerJobInput, ExtendWorkerLeaseInput, MarkWorkerJobRunningInput, WorkerJob } from "@/modules/runtime";
import { WORKER_JOB_STATUSES } from "@/modules/runtime";
import { conflictError, notFoundError } from "@/server/services/errors";
import { serviceFail, serviceOk, type ServiceResult } from "@/server/services/types";
import type { WorkerQueueRepository } from "./worker-queue-repository";

export interface WorkerLeaseService {
  claimNext(input: ClaimWorkerJobInput): Promise<ServiceResult<WorkerJob | null>>;
  markRunning(input: MarkWorkerJobRunningInput): Promise<ServiceResult<WorkerJob>>;
  extendLease(input: ExtendWorkerLeaseInput): Promise<ServiceResult<WorkerJob>>;
}

export function createWorkerLeaseService(repository: WorkerQueueRepository): WorkerLeaseService {
  return {
    async claimNext(input) {
      const job = await repository.claimNextJob(input);
      return serviceOk(job);
    },
    async markRunning(input) {
      const job = await repository.getJobById(input.jobId);
      if (!job || job.organizationId !== input.organizationId) {
        return serviceFail(notFoundError("Worker job not found."));
      }
      if (job.leasedBy !== input.workerId) {
        return serviceFail(conflictError("Worker job lease is owned by another worker."));
      }
      if (job.status !== WORKER_JOB_STATUSES.Leased && job.status !== WORKER_JOB_STATUSES.Running) {
        return serviceFail(conflictError("Only leased jobs can transition to running."));
      }

      const updated: WorkerJob = {
        ...job,
        status: WORKER_JOB_STATUSES.Running,
        updatedAt: input.now,
      };
      await repository.saveJob(updated);
      return serviceOk(updated);
    },
    async extendLease(input) {
      const job = await repository.getJobById(input.jobId);
      if (!job || job.organizationId !== input.organizationId) {
        return serviceFail(notFoundError("Worker job not found."));
      }
      if (job.leasedBy !== input.workerId) {
        return serviceFail(conflictError("Worker job lease is owned by another worker."));
      }
      if (job.status !== WORKER_JOB_STATUSES.Leased && job.status !== WORKER_JOB_STATUSES.Running) {
        return serviceFail(conflictError("Only leased jobs can extend their lease."));
      }

      const updated: WorkerJob = {
        ...job,
        leaseExpiresAt: new Date(Date.parse(input.now) + input.leaseDurationMs).toISOString(),
        updatedAt: input.now,
      };
      await repository.saveJob(updated);
      return serviceOk(updated);
    },
  };
}
