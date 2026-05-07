import "server-only";

import type {
  EventProcessingJobRecord,
  EventSubscriberDefinition,
  EventSubscriberJobRequest,
} from "@/modules/runtime";
import type { WorkerRuntimeService } from "./worker-runtime-service";
import { serviceFail, serviceOk, type ServiceResult } from "@/server/services";
import type { DomainEvent } from "@/server/events/types";
import type { IsoDateTimeString } from "@/types/entity";
import type { SlaSchedulerService } from "@/modules/sla";

export interface EventToJobService {
  enqueueJobs(input: {
    event: DomainEvent;
    subscriber: EventSubscriberDefinition;
    jobs: readonly EventSubscriberJobRequest[];
    correlationId: string;
    causationId: string;
    now: IsoDateTimeString;
  }): Promise<ServiceResult<readonly EventProcessingJobRecord[]>>;
}

export function createEventToJobService(
  workerRuntime: WorkerRuntimeService,
  dependencies: {
    slaScheduler?: SlaSchedulerService;
  } = {},
): EventToJobService {
  return {
    async enqueueJobs(input) {
      const queuedJobs: EventProcessingJobRecord[] = [];

      for (const job of input.jobs) {
        if (job.type === "sla.timer.evaluate" && dependencies.slaScheduler) {
          const scheduled = await dependencies.slaScheduler.scheduleFromEvent({
            event: input.event,
            request: {
              type: "sla.timer.evaluate",
              payloadVersion: job.payloadVersion as "v1",
              payload: job.payload as {
                timerType: "work_order.first_response_due";
                trigger: "created" | "internal_lifecycle_transition" | "internal_communication";
              },
              idempotencyKey: job.idempotencyKey,
            },
            correlationId: input.correlationId,
            causationId: input.causationId,
            now: input.now,
            enqueueRuntimeJob: async (runtimeJob) => {
              const queued = await workerRuntime.enqueue({
                organizationId: input.event.organizationId,
                actor: { userId: "system", role: "system" },
                now: input.now,
                type: runtimeJob.type,
                payload: runtimeJob.payload,
                payloadVersion: runtimeJob.payloadVersion,
                idempotencyKey: runtimeJob.idempotencyKey,
                correlationId: runtimeJob.correlationId,
                causationId: runtimeJob.causationId,
                sourceEventId: runtimeJob.sourceEventId,
                runAfter: runtimeJob.runAfter,
              });
              if (!queued.ok) {
                return serviceFail(queued.error);
              }
              return serviceOk({ id: queued.value.id });
            },
          });
          if (!scheduled.ok) {
            return serviceFail(scheduled.error);
          }
          if (!scheduled.value.runtimeJobId) {
            continue;
          }

          queuedJobs.push({
            jobId: scheduled.value.runtimeJobId,
            jobType: "sla.timer.evaluate",
            idempotencyKey: job.idempotencyKey,
          });
          continue;
        }

        const queued = await workerRuntime.enqueue({
          organizationId: input.event.organizationId,
          actor: { userId: "system", role: "system" },
          now: input.now,
          type: job.type,
          payload: job.payload,
          payloadVersion: job.payloadVersion,
          idempotencyKey: job.idempotencyKey,
          correlationId: input.correlationId,
          causationId: input.causationId,
          sourceEventId: input.event.id,
          maxAttempts: job.maxAttempts,
          runAfter: job.runAfter ?? undefined,
        });
        if (!queued.ok) {
          return serviceFail(queued.error);
        }

        queuedJobs.push({
          jobId: queued.value.id,
          jobType: queued.value.type,
          idempotencyKey: queued.value.idempotencyKey,
        });
      }

      return serviceOk(queuedJobs);
    },
  };
}
