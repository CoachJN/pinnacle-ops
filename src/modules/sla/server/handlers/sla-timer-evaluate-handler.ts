import "server-only";

import type { WorkerHandlerDefinition } from "@/modules/runtime";
import type { SlaEvaluatorService, SlaTimerEvaluateJobPayload } from "@/modules/sla";
import type { DomainServices } from "@/server/services";

export function createSlaTimerEvaluateHandler(
  evaluator: SlaEvaluatorService,
): WorkerHandlerDefinition<DomainServices> {
  return {
    type: "sla.timer.evaluate",
    description: "Evaluates canonical SLA timers against persisted work-order evidence.",
    async handle(context) {
      const payload = context.payload as Partial<SlaTimerEvaluateJobPayload>;
      if (payload.payloadVersion !== "v1") {
        return {
          success: false,
          message: "Unsupported SLA timer payload version.",
          retryable: false,
          errorCode: "sla_payload_version_invalid",
          errorDetails: {
            payloadVersion: payload.payloadVersion ?? null,
          },
        };
      }
      if (typeof payload.timerId !== "string" || payload.timerId.trim().length === 0) {
        return {
          success: false,
          message: "SLA timer id is required.",
          retryable: false,
          errorCode: "sla_timer_id_missing",
          errorDetails: {},
        };
      }

      const result = await evaluator.evaluateFirstResponseTimer({
        organizationId: context.organizationId,
        timerId: payload.timerId,
        runtimeJobId: context.job.id,
        now: context.startedAt,
        audit: {
          organizationId: context.organizationId,
          actor: { userId: "system", role: "system" },
          requestId: context.job.id,
          now: context.startedAt,
        },
      });
      if (!result.ok) {
        return {
          success: false,
          message: result.error.safeMessage,
          retryable: false,
          errorCode: result.error.code,
          errorDetails: {},
        };
      }

      return {
        success: true,
        message: result.value.message,
        metadata: {
          outcome: result.value.outcome,
          timerId: result.value.timer.id,
          timerStatus: result.value.timer.status,
          emittedEventId: result.value.emittedEvent?.id ?? null,
        },
      };
    },
  };
}
