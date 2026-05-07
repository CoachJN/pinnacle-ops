import "server-only";

import { resolveSlaDueAt, WORK_ORDER_FIRST_RESPONSE_SLA_POLICY } from "@/modules/sla";
import {
  buildSlaTimerEvaluatePayload,
  type SlaScheduleResult,
  type SlaTimer,
  type SlaTimerEvaluateJobPayload,
} from "@/modules/sla";
import type { DomainEvent, DomainEventType } from "@/server/events/types";
import { serviceOk, type ServiceResult } from "@/server/services/types";
import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { SlaTimerService } from "./sla-timer-service";

export interface SlaSchedulerService {
  scheduleFromEvent(input: {
    event: DomainEvent;
    request: {
      type: "sla.timer.evaluate";
      payloadVersion: "v1";
      payload: {
        timerType: "work_order.first_response_due";
        trigger: "created" | "internal_lifecycle_transition" | "internal_communication";
      };
      idempotencyKey: string;
    };
    correlationId: string;
    causationId: string;
    now: IsoDateTimeString;
    enqueueRuntimeJob: (input: {
      type: string;
      payload: SlaTimerEvaluateJobPayload;
      payloadVersion: "v1";
      idempotencyKey: string;
      runAfter: IsoDateTimeString;
      correlationId: string;
      causationId: string;
      sourceEventId: EntityId;
    }) => Promise<ServiceResult<{ id: EntityId }>>;
  }): Promise<ServiceResult<SlaScheduleResult>>;
}

export function createSlaSchedulerService(
  timerService: SlaTimerService,
): SlaSchedulerService {
  return {
    async scheduleFromEvent(input) {
      if (input.request.payload.timerType !== "work_order.first_response_due") {
        return serviceOk({
          timer: null,
          runtimeJobId: null,
          createdTimer: false,
          queuedJob: false,
        });
      }

      if (
        input.event.type === "work_order_created" &&
        input.event.workOrderId
      ) {
        const created = await timerService.createFirstResponseTimer({
          organizationId: input.event.organizationId,
          sourceEvent: input.event as DomainEvent<"work_order_created">,
          dueAt: resolveSlaDueAt(input.event, WORK_ORDER_FIRST_RESPONSE_SLA_POLICY),
          policyVersion: WORK_ORDER_FIRST_RESPONSE_SLA_POLICY.version,
          payloadVersion: "v1",
          correlationId: input.correlationId,
          causationId: input.causationId,
          now: input.now,
        });
        if (!created.ok) {
          return created;
        }

        const job = await input.enqueueRuntimeJob({
          type: "sla.timer.evaluate",
          payloadVersion: "v1",
          payload: buildSlaTimerEvaluatePayload(created.value.timer.id),
          idempotencyKey: `sla.timer.evaluate:${created.value.timer.id}:due:${created.value.timer.dueAt}`,
          runAfter: created.value.timer.dueAt,
          correlationId: input.correlationId,
          causationId: input.causationId,
          sourceEventId: input.event.id,
        });
        if (!job.ok) {
          return job;
        }

        const attached = await timerService.attachRuntimeJob({
          timer: created.value.timer,
          runtimeJobId: job.value.id,
          now: input.now,
        });
        if (!attached.ok) {
          return attached;
        }

        return serviceOk({
          timer: attached.value,
          runtimeJobId: job.value.id,
          createdTimer: created.value.created,
          queuedJob: true,
        });
      }

      const activeTimer = await timerService.loadTimerByWorkOrder(
        input.event.organizationId,
        input.event.workOrderId ?? null,
      );
      if (!activeTimer) {
        return serviceOk({
          timer: null,
          runtimeJobId: null,
          createdTimer: false,
          queuedJob: false,
        });
      }

      if (!shouldQueueImmediateEvaluation(input.event.type, input.event.visibility)) {
        return serviceOk({
          timer: activeTimer,
          runtimeJobId: null,
          createdTimer: false,
          queuedJob: false,
        });
      }

      const job = await input.enqueueRuntimeJob({
        type: "sla.timer.evaluate",
        payloadVersion: "v1",
        payload: buildSlaTimerEvaluatePayload(activeTimer.id),
        idempotencyKey: `sla.timer.evaluate:${activeTimer.id}:event:${input.event.id}`,
        runAfter: input.now,
        correlationId: input.correlationId,
        causationId: input.causationId,
        sourceEventId: input.event.id,
      });
      if (!job.ok) {
        return job;
      }

      const attached = await timerService.attachRuntimeJob({
        timer: activeTimer,
        runtimeJobId: job.value.id,
        now: input.now,
      });
      if (!attached.ok) {
        return attached;
      }

      return serviceOk({
        timer: attached.value,
        runtimeJobId: job.value.id,
        createdTimer: false,
        queuedJob: true,
      });
    },
  };
}

function shouldQueueImmediateEvaluation(
  eventType: DomainEventType,
  visibility: DomainEvent["visibility"],
): boolean {
  if (eventType === "communication_message_created") {
    return visibility === "internal";
  }
  if (eventType === "lifecycle_transitioned") {
    return visibility === "internal";
  }
  return false;
}
