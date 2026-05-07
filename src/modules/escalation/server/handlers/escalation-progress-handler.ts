import "server-only";

import type { WorkerHandlerDefinition } from "@/modules/runtime";
import type { EscalationProgressJobPayload } from "@/modules/escalation";
import type { DomainServices } from "@/server/services";

export function createEscalationProgressHandler(): WorkerHandlerDefinition<DomainServices> {
  return {
    type: "escalation.progress",
    description: "Creates, progresses, and cancels canonical escalation orchestrations safely.",
    async handle(context) {
      const payload = context.payload as Partial<EscalationProgressJobPayload>;
      if (payload.payloadVersion !== "v1") {
        return {
          success: false,
          message: "Unsupported escalation payload version.",
          retryable: false,
          errorCode: "escalation_payload_version_invalid",
          errorDetails: {
            payloadVersion: payload.payloadVersion ?? null,
          },
        };
      }
      if (payload.action !== "progress" && payload.action !== "cancel_if_resolved") {
        return {
          success: false,
          message: "Escalation action is invalid.",
          retryable: false,
          errorCode: "escalation_action_invalid",
          errorDetails: {},
        };
      }
      if (typeof payload.sourceSlaTimerId !== "string" || !payload.sourceSlaTimerId.trim()) {
        return {
          success: false,
          message: "Source SLA timer id is required.",
          retryable: false,
          errorCode: "escalation_source_timer_missing",
          errorDetails: {},
        };
      }
      if (typeof payload.targetEntityId !== "string" || !payload.targetEntityId.trim()) {
        return {
          success: false,
          message: "Target entity id is required.",
          retryable: false,
          errorCode: "escalation_target_missing",
          errorDetails: {},
        };
      }
      if (typeof payload.sourceEventId !== "string" || !payload.sourceEventId.trim()) {
        return {
          success: false,
          message: "Source event id is required.",
          retryable: false,
          errorCode: "escalation_source_event_missing",
          errorDetails: {},
        };
      }
      if (typeof payload.reason !== "string" || !payload.reason.trim()) {
        return {
          success: false,
          message: "Escalation reason is required.",
          retryable: false,
          errorCode: "escalation_reason_missing",
          errorDetails: {},
        };
      }

      const processed = await context.services.escalation.runtime.processJob({
        organizationId: context.organizationId,
        payload: payload as EscalationProgressJobPayload,
        runtimeJobId: context.job.id,
        correlationId: context.correlationId,
        causationId: context.causationId,
        sourceEventId: context.sourceEventId,
        now: context.startedAt,
        enqueueRuntimeJob: async (job) =>
          context.services.runtime.jobs.enqueue({
            organizationId: context.organizationId,
            actor: { userId: "system", role: "system" },
            now: context.startedAt,
            type: job.type,
            payloadVersion: job.payloadVersion,
            payload: job.payload,
            idempotencyKey: job.idempotencyKey,
            runAfter: job.runAfter,
            correlationId: job.correlationId,
            causationId: job.causationId,
            sourceEventId: job.sourceEventId,
          }),
      });
      if (!processed.ok) {
        return {
          success: false,
          message: processed.error.safeMessage,
          retryable: false,
          errorCode: processed.error.code,
          errorDetails: {},
        };
      }

      return {
        success: true,
        message: processed.value.message,
        metadata: {
          outcome: processed.value.outcome,
          orchestrationId: processed.value.orchestration?.id ?? null,
          escalationStatus: processed.value.orchestration?.status ?? null,
          currentStage: processed.value.orchestration?.currentStage?.stageNumber ?? null,
        },
      };
    },
  };
}
