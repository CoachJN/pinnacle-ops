import "server-only";

import type { WorkerJob } from "@/modules/runtime";
import type { ServiceActor } from "@/server/services";
import { serviceFail, serviceOk, type ServiceResult } from "@/server/services";
import { notFoundError, validationError } from "@/server/services/errors";
import { nowIso } from "@/server/services/types";
import type { FirestoreRepositories } from "@/server/repositories";
import type { WorkerRuntimeService } from "./worker-runtime-service";
import { assertReplayablePayload } from "./worker-runner-service";

export interface DeadLetterReplayService {
  replay(input: {
    organizationId: string;
    deadLetterId: string;
    actor: ServiceActor;
    force?: boolean;
    now?: string;
  }): Promise<ServiceResult<WorkerJob>>;
}

export function createDeadLetterReplayService(
  repositories: Pick<FirestoreRepositories, "runtimeDeadLetters" | "runtimeJobs">,
  runtimeJobs: WorkerRuntimeService,
): DeadLetterReplayService {
  return {
    async replay(input) {
      const deadLetter = await repositories.runtimeDeadLetters.getById(input.deadLetterId);
      if (!deadLetter || deadLetter.organizationId !== input.organizationId) {
        return serviceFail(notFoundError("Dead-letter record not found."));
      }

      const originalJob = await repositories.runtimeJobs.getById(deadLetter.originalJobId);
      if (!originalJob || originalJob.organizationId !== input.organizationId) {
        return serviceFail(notFoundError("Original worker job not found for dead-letter replay."));
      }

      if (originalJob.lastError && !originalJob.lastError.retryable && !input.force) {
        return serviceFail(
          validationError(
            "This dead-lettered job was marked non-retryable. Re-run with force=true to replay it.",
          ),
        );
      }

      assertReplayablePayload(deadLetter.payloadSnapshot);
      const timestamp = input.now ?? nowIso();
      const replayed = await runtimeJobs.enqueue({
        organizationId: input.organizationId,
        actor: input.actor,
        now: timestamp,
        type: originalJob.type,
        payloadVersion: originalJob.payloadVersion,
        idempotencyKey: [
          "dead-letter-replay",
          deadLetter.id,
          timestamp,
        ].join(":"),
        payload: {
          ...deadLetter.payloadSnapshot,
          replayOf: {
            deadLetterId: deadLetter.id,
            originalJobId: deadLetter.originalJobId,
            replayedAt: timestamp,
          },
        },
        correlationId: originalJob.correlationId,
        causationId: `dead-letter-replay:${deadLetter.id}`,
        sourceEventId: originalJob.sourceEventId,
        maxAttempts: originalJob.maxAttempts,
      });
      if (!replayed.ok) {
        return replayed;
      }

      return serviceOk(replayed.value);
    },
  };
}
