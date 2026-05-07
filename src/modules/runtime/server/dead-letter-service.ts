import "server-only";

import type { WorkerDeadLetterRecord, WorkerJob } from "@/modules/runtime";
import { serviceOk, type ServiceResult } from "@/server/services/types";
import type { WorkerDeadLetterRepositoryAdapter } from "./worker-queue-repository";

export interface DeadLetterService {
  routeJob(input: {
    deadLetterId: string;
    job: WorkerJob;
    now: string;
    errorSummary: string;
    payloadReference?: string | null;
  }): Promise<ServiceResult<WorkerDeadLetterRecord>>;
  listByOrganizationId(input: {
    organizationId: string;
    limit?: number;
  }): Promise<ServiceResult<WorkerDeadLetterRecord[]>>;
}

export function createDeadLetterService(
  repository: WorkerDeadLetterRepositoryAdapter,
): DeadLetterService {
  return {
    async routeJob(input) {
      const record: WorkerDeadLetterRecord = {
        id: input.deadLetterId,
        organizationId: input.job.organizationId,
        tenantId: input.job.tenantId,
        originalJobId: input.job.id,
        jobType: input.job.type,
        payloadSnapshot: input.job.payload,
        payloadReference: input.payloadReference ?? null,
        errorSummary: input.errorSummary,
        finalAttemptCount: input.job.attemptCount,
        correlationId: input.job.correlationId,
        causationId: input.job.causationId,
        sourceEventId: input.job.sourceEventId,
        createdAt: input.now,
      };

      await repository.createDeadLetter(record);
      return serviceOk(record);
    },
    async listByOrganizationId(input) {
      const result = await repository.listDeadLettersByOrganizationId(
        input.organizationId,
        input.limit,
      );
      return serviceOk(result.items);
    },
  };
}
