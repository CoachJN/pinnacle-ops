import "server-only";

import type { WorkerDeadLetterRecord, WorkerJob } from "@/modules/runtime";
import type { FirestoreRepositories, RepositoryListResult } from "@/server/repositories";
import type { EntityId } from "@/types/entity";

export interface ClaimNextWorkerJobInput {
  organizationId: EntityId;
  workerId: string;
  leaseDurationMs: number;
  now: string;
  jobTypes?: readonly string[];
}

export interface FindWorkerJobByIdempotencyKeyInput {
  organizationId: EntityId;
  type: string;
  idempotencyKey: string;
}

export interface WorkerQueueRepository {
  newJobId(): EntityId;
  getJobById(jobId: EntityId): Promise<WorkerJob | null>;
  createJob(job: WorkerJob): Promise<WorkerJob>;
  saveJob(job: WorkerJob): Promise<WorkerJob>;
  findJobByIdempotencyKey(input: FindWorkerJobByIdempotencyKeyInput): Promise<WorkerJob | null>;
  claimNextJob(input: ClaimNextWorkerJobInput): Promise<WorkerJob | null>;
  listJobsByOrganizationId(
    organizationId: EntityId,
    limit?: number,
  ): Promise<RepositoryListResult<WorkerJob>>;
  listJobsByTimer(input: {
    organizationId: EntityId;
    timerId: EntityId;
    statuses?: readonly WorkerJob["status"][];
    limit?: number;
  }): Promise<RepositoryListResult<WorkerJob>>;
}

export interface WorkerDeadLetterRepositoryAdapter {
  newDeadLetterId(): EntityId;
  getDeadLetterByOriginalJobId(jobId: EntityId): Promise<WorkerDeadLetterRecord | null>;
  createDeadLetter(record: WorkerDeadLetterRecord): Promise<WorkerDeadLetterRecord>;
  listDeadLettersByOrganizationId(
    organizationId: EntityId,
    limit?: number,
  ): Promise<RepositoryListResult<WorkerDeadLetterRecord>>;
}

export function createWorkerQueueRepository(
  repositories: Pick<FirestoreRepositories, "runtimeJobs" | "runtimeDeadLetters">,
): WorkerQueueRepository & WorkerDeadLetterRepositoryAdapter {
  return {
    newJobId: () => repositories.runtimeJobs.newId(),
    async getJobById(jobId) {
      return repositories.runtimeJobs.getById(jobId);
    },
    async createJob(job) {
      await repositories.runtimeJobs.create(job);
      return job;
    },
    async saveJob(job) {
      await repositories.runtimeJobs.save(job);
      return job;
    },
    findJobByIdempotencyKey(input) {
      return repositories.runtimeJobs.findByIdempotencyKey(input);
    },
    claimNextJob(input) {
      return repositories.runtimeJobs.claimNext(input);
    },
    listJobsByOrganizationId(organizationId, limit) {
      return repositories.runtimeJobs.listByOrganizationId(organizationId, limit ? { limit } : undefined);
    },
    listJobsByTimer(input) {
      return repositories.runtimeJobs.listByTimer(input);
    },
    newDeadLetterId: () => repositories.runtimeDeadLetters.newId(),
    getDeadLetterByOriginalJobId(jobId) {
      return repositories.runtimeDeadLetters.findByOriginalJobId(jobId);
    },
    async createDeadLetter(record) {
      await repositories.runtimeDeadLetters.create(record);
      return record;
    },
    listDeadLettersByOrganizationId(organizationId, limit) {
      return repositories.runtimeDeadLetters.listByOrganizationId(
        organizationId,
        limit ? { limit } : undefined,
      );
    },
  };
}
