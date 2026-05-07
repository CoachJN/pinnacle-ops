import "server-only";

import { calculateWorkerRetrySchedule, type DeliveryPlan, type DeliveryPolicyService } from "@/modules/delivery";
import type { DeliveryAttempt, TransportExecuteJobPayload } from "@/modules/transport";
import { serviceFail, serviceOk, type ServiceResult } from "@/server/services";
import { validationError } from "@/server/services/errors";
import type { EntityId, IsoDateTimeString } from "@/types/entity";

export interface TransportRetryService {
  scheduleRetry(input: {
    deliveryPlan: DeliveryPlan;
    attempt: DeliveryAttempt;
    failureCode: string;
    failureReason: string;
    now: IsoDateTimeString;
    enqueueRuntimeJob: (job: {
      type: "transport.execute";
      payloadVersion: "v1";
      payload: TransportExecuteJobPayload;
      idempotencyKey: string;
      runAfter: IsoDateTimeString;
      correlationId: string;
      causationId: string;
      sourceEventId: EntityId;
      maxAttempts?: number;
    }) => Promise<ServiceResult<{ id: EntityId }>>;
  }): Promise<
    ServiceResult<{
      nextAttemptNumber: number;
      nextRetryAt: IsoDateTimeString;
      runtimeJobId: EntityId;
    }>
  >;
}

export function createTransportRetryService(
  policyService: DeliveryPolicyService,
): TransportRetryService {
  return {
    async scheduleRetry(input) {
      const policy = policyService.getPolicy(input.deliveryPlan.deliveryType);
      if (!policy) {
        return serviceFail(validationError("Delivery policy is not configured."));
      }

      const nextAttemptNumber = input.attempt.retryCount + 1;
      if (nextAttemptNumber >= policy.retry.maxAttempts) {
        return serviceFail(validationError("Retry budget exhausted."));
      }

      const schedule = calculateWorkerRetrySchedule({
        attemptCount: nextAttemptNumber,
        now: input.now,
        stableKey: `${input.deliveryPlan.id}:${input.attempt.idempotencyKey}:${input.failureCode}`,
        policy: {
          baseDelayMs: policy.retry.baseDelayMs,
          maxDelayMs: policy.retry.maxDelayMs,
          jitterRatio: policy.retry.jitterRatio,
        },
      });

      const queued = await input.enqueueRuntimeJob({
        type: "transport.execute",
        payloadVersion: "v1",
        payload: {
          payloadVersion: "v1",
          deliveryPlanId: input.deliveryPlan.id,
          deliveryType: input.deliveryPlan.deliveryType,
          attemptNumber: nextAttemptNumber,
          reason: "transport_retry_scheduled",
          triggerEventType: "transport_attempt_retry_scheduled",
        },
        idempotencyKey: buildTransportAttemptJobIdempotencyKey(input.deliveryPlan.id, nextAttemptNumber),
        runAfter: schedule.nextRunAfter,
        correlationId: input.deliveryPlan.correlationId,
        causationId: input.attempt.id,
        sourceEventId: input.deliveryPlan.sourceEventId,
        maxAttempts: 1,
      });
      if (!queued.ok) {
        return queued;
      }

      return serviceOk({
        nextAttemptNumber,
        nextRetryAt: schedule.nextRunAfter,
        runtimeJobId: queued.value.id,
      });
    },
  };
}

export function buildTransportAttemptJobIdempotencyKey(
  deliveryPlanId: EntityId,
  attemptNumber: number,
): string {
  return ["transport.execute", deliveryPlanId, "attempt", String(attemptNumber)].join(":");
}
