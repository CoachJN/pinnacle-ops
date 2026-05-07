import "server-only";

import type {
  WorkerFailureDiagnostic,
  WorkerRuntimeDiagnostics,
} from "@/modules/runtime";
import { WORKER_JOB_STATUSES } from "@/modules/runtime";
import { serviceOk, type ServiceResult } from "@/server/services/types";
import type { WorkerDeadLetterRepositoryAdapter, WorkerQueueRepository } from "./worker-queue-repository";

export interface RuntimeDiagnosticsService {
  getSummary(input: {
    organizationId: string;
    limit?: number;
  }): Promise<ServiceResult<WorkerRuntimeDiagnostics>>;
}

export function createRuntimeDiagnosticsService(
  jobs: WorkerQueueRepository,
  deadLetters: WorkerDeadLetterRepositoryAdapter,
): RuntimeDiagnosticsService {
  return {
    async getSummary(input) {
      const [jobList, deadLetterList] = await Promise.all([
        jobs.listJobsByOrganizationId(input.organizationId, 500),
        deadLetters.listDeadLettersByOrganizationId(input.organizationId, input.limit ?? 50),
      ]);

      const queuedJobs = jobList.items.filter((job) => job.status === WORKER_JOB_STATUSES.Queued);
      const leasedJobs = jobList.items.filter(
        (job) =>
          job.status === WORKER_JOB_STATUSES.Leased || job.status === WORKER_JOB_STATUSES.Running,
      );
      const failedJobs = jobList.items.filter((job) => job.status === WORKER_JOB_STATUSES.Failed);
      const oldestQueuedJob = [...queuedJobs].sort((left, right) =>
        left.runAfter.localeCompare(right.runAfter),
      )[0] ?? null;

      const jobsByType = [...jobList.items]
        .reduce<Map<string, number>>((counts, job) => {
          counts.set(job.type, (counts.get(job.type) ?? 0) + 1);
          return counts;
        }, new Map())
        .entries();

      const recentFailures: WorkerFailureDiagnostic[] = [
        ...jobList.items
          .filter((job) => job.lastError)
          .map((job) => ({
            jobId: job.id,
            jobType: job.type,
            status: job.status,
            attemptCount: job.attemptCount,
            lastError: job.lastError,
            deadLetterRecordId: null,
            updatedAt: job.updatedAt,
          })),
        ...deadLetterList.items.map((record) => ({
          jobId: record.originalJobId,
          jobType: record.jobType,
          status: WORKER_JOB_STATUSES.DeadLettered,
          attemptCount: record.finalAttemptCount,
          lastError: null,
          deadLetterRecordId: record.id,
          updatedAt: record.createdAt,
        })),
      ]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, input.limit ?? 20);

      return serviceOk({
        queuedCount: queuedJobs.length,
        leasedCount: leasedJobs.length,
        failedCount: failedJobs.length,
        deadLetterCount: deadLetterList.items.length,
        oldestQueuedJob,
        jobsByType: [...jobsByType]
          .map(([type, count]) => ({ type, count }))
          .sort((left, right) => left.type.localeCompare(right.type)),
        recentFailures,
      });
    },
  };
}
