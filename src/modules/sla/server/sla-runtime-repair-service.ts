import "server-only";

import { WORKER_JOB_STATUSES, type WorkerJob } from "@/modules/runtime";
import {
  buildSlaTimerEvaluatePayload,
  SLA_SCAN_ACTIONS,
  type SlaScanFinding,
  type SlaTimer,
} from "@/modules/sla";
import { serviceOk, type ServiceResult } from "@/server/services";
import type { WorkerQueueRepository } from "@/modules/runtime/server/worker-queue-repository";
import type { SlaTimerService } from "./sla-timer-service";

export interface SlaRuntimeRepairService {
  repairFinding(input: {
    finding: SlaScanFinding;
    now: string;
    enqueueRuntimeJob: (input: {
      type: string;
      payload: Record<string, unknown>;
      payloadVersion: "v1";
      idempotencyKey: string;
      runAfter: string;
      correlationId: string;
      causationId: string;
      sourceEventId: string;
    }) => Promise<ServiceResult<WorkerJob>>;
  }): Promise<
    ServiceResult<{
      timer: SlaTimer;
      repaired: boolean;
      enqueued: boolean;
      runtimeJobId: string | null;
    }>
  >;
}

export function createSlaRuntimeRepairService(
  dependencies: {
    timers: SlaTimerService;
    jobs: WorkerQueueRepository;
  },
): SlaRuntimeRepairService {
  return {
    async repairFinding(input) {
      if (input.finding.action === SLA_SCAN_ACTIONS.None) {
        return serviceOk({
          timer: input.finding.timer,
          repaired: false,
          enqueued: false,
          runtimeJobId: input.finding.timer.runtimeJobId,
        });
      }

      if (
        input.finding.action === SLA_SCAN_ACTIONS.AttachActiveJob &&
        input.finding.activeJobId
      ) {
        if (input.finding.timer.runtimeJobId === input.finding.activeJobId) {
          return serviceOk({
            timer: input.finding.timer,
            repaired: false,
            enqueued: false,
            runtimeJobId: input.finding.activeJobId,
          });
        }

        const attached = await dependencies.timers.attachRuntimeJob({
          timer: input.finding.timer,
          runtimeJobId: input.finding.activeJobId,
          now: input.now,
        });
        if (!attached.ok) {
          return attached;
        }
        return serviceOk({
          timer: attached.value,
          repaired: true,
          enqueued: false,
          runtimeJobId: input.finding.activeJobId,
        });
      }

      const timer = input.finding.timer;
      const idempotencyKey = buildRepairIdempotencyKey(timer);
      const existing = await dependencies.jobs.findJobByIdempotencyKey({
        organizationId: timer.organizationId,
        type: "sla.timer.evaluate",
        idempotencyKey,
      });

      const enqueueResult =
        existing !== null
          ? serviceOk(existing)
          : await input.enqueueRuntimeJob({
              type: "sla.timer.evaluate",
              payloadVersion: "v1",
              payload: buildSlaTimerEvaluatePayload(timer.id),
              idempotencyKey,
              runAfter: timer.dueAt <= input.now ? input.now : timer.dueAt,
              correlationId: timer.correlationId,
              causationId: timer.causationId,
              sourceEventId: timer.sourceEventId,
            });
      if (!enqueueResult.ok) {
        return enqueueResult;
      }

      const runtimeJob = enqueueResult.value;
      const attached =
        timer.runtimeJobId === runtimeJob.id
          ? serviceOk(timer)
          : await dependencies.timers.attachRuntimeJob({
              timer,
              runtimeJobId: runtimeJob.id,
              now: input.now,
            });
      if (!attached.ok) {
        return attached;
      }

      return serviceOk({
        timer: attached.value,
        repaired: true,
        enqueued:
          runtimeJob.status === WORKER_JOB_STATUSES.Queued ||
          runtimeJob.status === WORKER_JOB_STATUSES.Leased ||
          runtimeJob.status === WORKER_JOB_STATUSES.Running,
        runtimeJobId: runtimeJob.id,
      });
    },
  };
}

export function buildRepairIdempotencyKey(timer: SlaTimer): string {
  if (timer.runtimeJobId) {
    return `sla.timer.evaluate:${timer.id}:repair:after:${timer.runtimeJobId}`;
  }
  return `sla.timer.evaluate:${timer.id}:repair:due:${timer.dueAt}`;
}
