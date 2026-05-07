import "server-only";

import type { WorkerHandlerDefinition } from "@/modules/runtime";
import type { TransportExecuteJobPayload } from "@/modules/transport";
import type { DomainServices } from "@/server/services";

export function createTransportExecuteHandler(): WorkerHandlerDefinition<DomainServices> {
  return {
    type: "transport.execute",
    description: "Executes canonical delivery transport attempts through isolated transport adapters.",
    async handle(context) {
      const payload = context.payload as Partial<TransportExecuteJobPayload>;
      if (payload.payloadVersion !== "v1") {
        return {
          success: false,
          message: "Unsupported transport payload version.",
          retryable: false,
          errorCode: "transport_payload_version_invalid",
          errorDetails: {
            payloadVersion: payload.payloadVersion ?? null,
          },
        };
      }
      if (typeof payload.deliveryPlanId !== "string" || !payload.deliveryPlanId.trim()) {
        return {
          success: false,
          message: "deliveryPlanId is required.",
          retryable: false,
          errorCode: "transport_delivery_plan_missing",
          errorDetails: {},
        };
      }
      if (typeof payload.reason !== "string" || !payload.reason.trim()) {
        return {
          success: false,
          message: "Transport reason is required.",
          retryable: false,
          errorCode: "transport_reason_missing",
          errorDetails: {},
        };
      }
      if (
        payload.triggerEventType !== "delivery_planned" &&
        payload.triggerEventType !== "delivery_scheduled" &&
        payload.triggerEventType !== "transport_attempt_retry_scheduled"
      ) {
        return {
          success: false,
          message: "Transport trigger event type is invalid.",
          retryable: false,
          errorCode: "transport_trigger_invalid",
          errorDetails: {},
        };
      }

      const processed = await context.services.transport.runtime.processJob({
        organizationId: context.organizationId,
        payload: payload as TransportExecuteJobPayload,
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
            maxAttempts: job.maxAttempts ?? 1,
          }),
      });
      if (!processed.ok) {
        return {
          success: false,
          message: processed.error.safeMessage,
          retryable: true,
          errorCode: processed.error.code,
          errorDetails: {},
        };
      }

      return {
        success: true,
        message: processed.value.message,
        metadata: {
          outcome: processed.value.outcome,
          deliveryAttemptId: processed.value.attempt.id,
          status: processed.value.attempt.status,
          deliveryPlanId: processed.value.attempt.deliveryPlanId,
        },
      };
    },
  };
}
