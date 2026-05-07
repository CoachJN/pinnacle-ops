import "server-only";

import type { WorkerHandlerDefinition } from "@/modules/runtime";
import type { DeliveryPlanProcessJobPayload } from "@/modules/delivery";
import type { DomainServices } from "@/server/services";

export function createDeliveryPlanHandler(): WorkerHandlerDefinition<DomainServices> {
  return {
    type: "delivery.plan.process",
    description: "Creates, schedules, suppresses, and completes canonical delivery plans safely.",
    async handle(context) {
      const payload = context.payload as Partial<DeliveryPlanProcessJobPayload>;
      if (payload.payloadVersion !== "v1") {
        return {
          success: false,
          message: "Unsupported delivery payload version.",
          retryable: false,
          errorCode: "delivery_payload_version_invalid",
          errorDetails: {
            payloadVersion: payload.payloadVersion ?? null,
          },
        };
      }
      if (
        payload.action !== "plan_from_escalation_event" &&
        payload.action !== "cancel_for_escalation"
      ) {
        return {
          success: false,
          message: "Delivery action is invalid.",
          retryable: false,
          errorCode: "delivery_action_invalid",
          errorDetails: {},
        };
      }
      if (payload.deliveryType !== "escalation.first_response_breach_notification") {
        return {
          success: false,
          message: "Unsupported delivery type.",
          retryable: false,
          errorCode: "delivery_type_invalid",
          errorDetails: {},
        };
      }
      if (typeof payload.reason !== "string" || !payload.reason.trim()) {
        return {
          success: false,
          message: "Delivery reason is required.",
          retryable: false,
          errorCode: "delivery_reason_missing",
          errorDetails: {},
        };
      }

      const processed = await context.services.delivery.runtime.processJob({
        organizationId: context.organizationId,
        payload: payload as DeliveryPlanProcessJobPayload,
        runtimeJobId: context.job.id,
        correlationId: context.correlationId,
        causationId: context.causationId,
        sourceEventId: context.sourceEventId,
        now: context.startedAt,
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
          deliveryPlanIds: processed.value.plans.map((plan) => plan.id),
          statuses: processed.value.plans.map((plan) => plan.status),
        },
      };
    },
  };
}
