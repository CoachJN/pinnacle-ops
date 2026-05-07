import "server-only";

import {
  DELIVERY_PLAN_STATUSES,
  type DeliveryPlan,
  type DeliveryPolicyService,
} from "@/modules/delivery";
import type {
  DeliveryAttempt,
  DeliveryReceipt,
  TransportAdapterRegistry,
  TransportAttemptRepository,
  TransportExecuteJobPayload,
  TransportReceiptService,
  TransportRetryService,
  TransportResult,
} from "@/modules/transport";
import type { ProviderReceiptCaptureService } from "@/modules/provider-runtime";
import type { FirestoreRepositories } from "@/server/repositories";
import type { DomainEventService } from "@/server/services";
import { serviceFail, serviceOk, type ServiceResult } from "@/server/services";
import { notFoundError, validationError } from "@/server/services/errors";
import type { EntityId, IsoDateTimeString } from "@/types/entity";

export interface TransportRuntimeService {
  processJob(input: {
    organizationId: string;
    payload: TransportExecuteJobPayload;
    runtimeJobId: string;
    correlationId: string;
    causationId: string;
    sourceEventId: string | null;
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
      attempt: DeliveryAttempt;
      outcome:
        | "succeeded"
        | "failed"
        | "retry_scheduled"
        | "cancelled"
        | "suppressed"
        | "noop_duplicate"
        | "noop_stale";
      message: string;
    }>
  >;
}

export function createTransportRuntimeService(
  repositories: Pick<FirestoreRepositories, "deliveryPlans">,
  attempts: TransportAttemptRepository,
  policyService: DeliveryPolicyService,
  retryService: TransportRetryService,
  receiptService: TransportReceiptService,
  registry: TransportAdapterRegistry,
  domainEvents: DomainEventService,
  providerRuntime?: ProviderReceiptCaptureService,
): TransportRuntimeService {
  return {
    async processJob(input) {
      const plan = await repositories.deliveryPlans.getById(input.payload.deliveryPlanId);
      if (!plan || plan.organizationId !== input.organizationId) {
        return serviceFail(notFoundError("Delivery plan not found."));
      }
      if (plan.deliveryType !== input.payload.deliveryType) {
        return serviceFail(validationError("Delivery plan type does not match transport payload."));
      }
      if (!Number.isInteger(input.payload.attemptNumber) || input.payload.attemptNumber < 0) {
        return serviceFail(validationError("attemptNumber must be a non-negative integer."));
      }

      const adapter = registry.getByChannel(plan.channel);
      if (!adapter) {
        return serviceFail(validationError("No transport adapter is registered for the delivery channel."));
      }

      const attemptIdempotencyKey = buildTransportAttemptIdempotencyKey(plan.id, input.payload.attemptNumber);
      const existingAttempt = await attempts.findByIdempotencyKey({
        organizationId: input.organizationId,
        deliveryPlanId: plan.id,
        idempotencyKey: attemptIdempotencyKey,
      });
      const historicalAttempts = await attempts.listByDeliveryPlanId({
        organizationId: input.organizationId,
        deliveryPlanId: plan.id,
        limit: 100,
      });

      if (historicalAttempts.some((attempt) => attempt.status === "succeeded")) {
        const succeeded = historicalAttempts.find((attempt) => attempt.status === "succeeded")!;
        await recordTransportEvent(domainEvents, {
          organizationId: plan.organizationId,
          workOrderId: plan.targetEntityId,
          now: input.now,
          correlationId: succeeded.correlationId,
          reason: "transport_attempt_duplicate_after_success",
          type: "transport_attempt_noop",
          summary: `Transport attempt replay for plan ${plan.id} nooped after success.`,
          attempt: succeeded,
          payload: {
            deliveryAttemptId: succeeded.id,
            deliveryPlanId: succeeded.deliveryPlanId,
            status: succeeded.status,
            reason: "already_succeeded",
          },
        });
        return serviceOk({
          attempt: succeeded,
          outcome: "noop_duplicate",
          message: "Transport execution already succeeded for this delivery plan.",
        });
      }

      if (existingAttempt) {
        if (existingAttempt.status === "retry_scheduled") {
          return serviceOk({
            attempt: existingAttempt,
            outcome: "noop_duplicate",
            message: "Retry was already scheduled for this transport attempt.",
          });
        }
        if (
          existingAttempt.status === "failed" ||
          existingAttempt.status === "cancelled" ||
          existingAttempt.status === "suppressed" ||
          existingAttempt.status === "succeeded"
        ) {
          await recordTransportEvent(domainEvents, {
            organizationId: plan.organizationId,
            workOrderId: plan.targetEntityId,
            now: input.now,
            correlationId: existingAttempt.correlationId,
            reason: "transport_attempt_duplicate_existing_terminal",
            type: "transport_attempt_noop",
            summary: `Transport attempt ${existingAttempt.id} already reached ${existingAttempt.status}.`,
            attempt: existingAttempt,
            payload: {
              deliveryAttemptId: existingAttempt.id,
              deliveryPlanId: existingAttempt.deliveryPlanId,
              status: existingAttempt.status,
              reason: "existing_terminal_attempt",
            },
          });
          return serviceOk({
            attempt: existingAttempt,
            outcome: "noop_duplicate",
            message: `Transport attempt is already ${existingAttempt.status}.`,
          });
        }
      }

      if (plan.status === DELIVERY_PLAN_STATUSES.Cancelled) {
        const cancelled = await upsertSuppressedOrCancelledAttempt({
          attempt: existingAttempt,
          attempts,
          plan,
          now: input.now,
          status: "cancelled",
          reason: plan.cancellationReason ?? "delivery_plan_cancelled",
          adapterType: adapter.adapterType,
          sourceEventId: input.sourceEventId ?? plan.sourceEventId,
          correlationId: input.correlationId,
          causationId: input.causationId,
          idempotencyKey: attemptIdempotencyKey,
          domainEvents,
        });
        return serviceOk({
          attempt: cancelled,
          outcome: "cancelled",
          message: "Transport execution was cancelled because the delivery plan is cancelled.",
        });
      }

      if (plan.status === DELIVERY_PLAN_STATUSES.Suppressed) {
        const suppressed = await upsertSuppressedOrCancelledAttempt({
          attempt: existingAttempt,
          attempts,
          plan,
          now: input.now,
          status: "suppressed",
          reason: plan.suppressionReason ?? "delivery_plan_suppressed",
          adapterType: adapter.adapterType,
          sourceEventId: input.sourceEventId ?? plan.sourceEventId,
          correlationId: input.correlationId,
          causationId: input.causationId,
          idempotencyKey: attemptIdempotencyKey,
          domainEvents,
        });
        return serviceOk({
          attempt: suppressed,
          outcome: "suppressed",
          message: "Transport execution was suppressed because the delivery plan is suppressed.",
        });
      }

      const queued = existingAttempt ?? (await createAttempt(attempts, plan, {
        now: input.now,
        adapterType: adapter.adapterType,
        sourceEventId: input.sourceEventId ?? plan.sourceEventId,
        correlationId: input.correlationId,
        causationId: input.causationId,
        idempotencyKey: attemptIdempotencyKey,
        retryCount: input.payload.attemptNumber,
      }));
      if (!existingAttempt) {
        await appendRecordedEvent(attempts, queued, await recordTransportEvent(domainEvents, {
          organizationId: plan.organizationId,
          workOrderId: plan.targetEntityId,
          now: input.now,
          correlationId: queued.correlationId,
          reason: input.payload.reason,
          type: "transport_attempt_queued",
          summary: `Transport attempt ${queued.id} queued for delivery plan ${plan.id}.`,
          attempt: queued,
          payload: baseAttemptPayload(queued),
        }));
      }

      const executing = await saveAttempt(attempts, {
        ...queued,
        status: "executing",
        executionStartedAt: queued.executionStartedAt ?? input.now,
        updatedAt: input.now,
      });
      await appendRecordedEvent(attempts, executing, await recordTransportEvent(domainEvents, {
        organizationId: plan.organizationId,
        workOrderId: plan.targetEntityId,
        now: input.now,
        correlationId: executing.correlationId,
        reason: input.payload.reason,
        type: "transport_attempt_executing",
        summary: `Transport attempt ${executing.id} started execution.`,
        attempt: executing,
        payload: baseAttemptPayload(executing),
      }));

      const result = await adapter.execute({
        payload: {
          organizationId: input.organizationId,
          now: input.now,
          deliveryPlan: {
            id: plan.id,
            deliveryType: plan.deliveryType,
            channel: plan.channel,
            targetEntityType: plan.targetEntityType,
            targetEntityId: plan.targetEntityId,
            recipientType: plan.recipientType,
            recipientId: plan.recipientId,
            recipientAddress: plan.recipientAddress,
            templateId: plan.templateId,
            templateVersion: plan.templateVersion,
            priority: plan.priority,
            correlationId: plan.correlationId,
            causationId: plan.causationId,
            sourceEventId: plan.sourceEventId,
          },
          attempt: {
            id: executing.id,
            deliveryPlanId: executing.deliveryPlanId,
            retryCount: executing.retryCount,
            correlationId: executing.correlationId,
            causationId: executing.causationId,
            sourceEventId: executing.sourceEventId,
            idempotencyKey: executing.idempotencyKey,
          },
        },
      });

      if (result.outcome === "accepted" || result.outcome === "queued") {
        const receipt = receiptService.createReceipt({
          attempt: executing,
          receipt: result.receipt,
        });
        const pending = await saveAttempt(attempts, {
          ...executing,
          providerMessageId: receipt.providerMessageId,
          providerCorrelationId: receipt.providerCorrelationId,
          providerReceiptId: receipt.providerReceiptId,
          updatedAt: input.now,
        });
        await appendRecordedEvent(attempts, pending, await recordTransportEvent(domainEvents, {
          organizationId: plan.organizationId,
          workOrderId: plan.targetEntityId,
          now: input.now,
          correlationId: pending.correlationId,
          reason: input.payload.reason,
          type: "transport_attempt_executing",
          summary: `Transport attempt ${pending.id} is awaiting provider reconciliation.`,
          attempt: pending,
          payload: {
            ...baseAttemptPayload(pending),
            providerMessageId: pending.providerMessageId,
            providerCorrelationId: pending.providerCorrelationId,
            providerReceiptId: pending.providerReceiptId,
            providerStatus: result.outcome,
          },
        }));
        if (providerRuntime) {
          await providerRuntime.recordAdapterReceipt({
            organizationId: input.organizationId,
            providerType: result.providerType,
            providerEventType: result.providerEventType,
            providerMessageId: receipt.providerMessageId,
            providerCorrelationId: receipt.providerCorrelationId,
            providerReceiptId: receipt.providerReceiptId,
            deliveryAttemptId: pending.id,
            deliveryPlanId: pending.deliveryPlanId,
            correlationId: pending.correlationId,
            causationId: pending.id,
            normalizedStatus: result.outcome,
            rawStatus: result.rawStatus,
            now: input.now,
            metadata: result.metadata,
          });
        }
        await repositories.deliveryPlans.save({
          ...plan,
          status: DELIVERY_PLAN_STATUSES.Scheduled,
          activeRuntimeJobId: input.runtimeJobId,
          nextAttemptAt: null,
          retryCount: pending.retryCount,
          updatedAt: input.now,
        });
        return serviceOk({
          attempt: pending,
          outcome: "succeeded",
          message: result.message,
        });
      }

      if (result.outcome === "succeeded") {
        const receipt = receiptService.createReceipt({
          attempt: executing,
          receipt: result.receipt,
        });
        const succeeded = await saveAttempt(attempts, completeAttempt(executing, input.now, "succeeded", receipt));
        const event = await recordTransportEvent(domainEvents, {
          organizationId: plan.organizationId,
          workOrderId: plan.targetEntityId,
          now: input.now,
          correlationId: succeeded.correlationId,
          reason: input.payload.reason,
          type: "transport_attempt_succeeded",
          summary: `Transport attempt ${succeeded.id} succeeded.`,
          attempt: succeeded,
          payload: {
            ...baseAttemptPayload(succeeded),
            providerMessageId: succeeded.providerMessageId,
            providerCorrelationId: succeeded.providerCorrelationId,
            providerReceiptId: succeeded.providerReceiptId,
          },
        });
        await appendRecordedEvent(attempts, succeeded, event);
        await repositories.deliveryPlans.save({
          ...plan,
          status: DELIVERY_PLAN_STATUSES.Completed,
          activeRuntimeJobId: input.runtimeJobId,
          nextAttemptAt: null,
          retryCount: succeeded.retryCount,
          updatedAt: input.now,
        });
        await recordDeliveryCompletion(domainEvents, plan, input.now, input.payload.reason);
        return serviceOk({
          attempt: succeeded,
          outcome: "succeeded",
          message: result.message,
        });
      }

      if (result.outcome === "suppressed") {
        const receipt = receiptService.createReceipt({
          attempt: executing,
          receipt: result.receipt,
        });
        const suppressed = await saveAttempt(attempts, completeAttempt(executing, input.now, "suppressed", receipt, {
          failureReason: result.suppressionReason,
        }));
        const event = await recordTransportEvent(domainEvents, {
          organizationId: plan.organizationId,
          workOrderId: plan.targetEntityId,
          now: input.now,
          correlationId: suppressed.correlationId,
          reason: result.suppressionReason,
          type: "transport_attempt_suppressed",
          summary: `Transport attempt ${suppressed.id} was suppressed.`,
          attempt: suppressed,
          payload: {
            ...baseAttemptPayload(suppressed),
            suppressionReason: result.suppressionReason,
          },
        });
        await appendRecordedEvent(attempts, suppressed, event);
        await repositories.deliveryPlans.save({
          ...plan,
          status: DELIVERY_PLAN_STATUSES.Suppressed,
          suppressionReason: result.suppressionReason,
          activeRuntimeJobId: null,
          nextAttemptAt: null,
          updatedAt: input.now,
        });
        return serviceOk({
          attempt: suppressed,
          outcome: "suppressed",
          message: result.message,
        });
      }

      if (result.outcome === "cancelled") {
        const receipt = receiptService.createReceipt({
          attempt: executing,
          receipt: result.receipt,
        });
        const cancelled = await saveAttempt(attempts, completeAttempt(executing, input.now, "cancelled", receipt, {
          failureReason: result.cancellationReason,
        }));
        const event = await recordTransportEvent(domainEvents, {
          organizationId: plan.organizationId,
          workOrderId: plan.targetEntityId,
          now: input.now,
          correlationId: cancelled.correlationId,
          reason: result.cancellationReason,
          type: "transport_attempt_cancelled",
          summary: `Transport attempt ${cancelled.id} was cancelled.`,
          attempt: cancelled,
          payload: {
            ...baseAttemptPayload(cancelled),
            cancellationReason: result.cancellationReason,
          },
        });
        await appendRecordedEvent(attempts, cancelled, event);
        await repositories.deliveryPlans.save({
          ...plan,
          status: DELIVERY_PLAN_STATUSES.Cancelled,
          cancellationReason: result.cancellationReason,
          activeRuntimeJobId: null,
          nextAttemptAt: null,
          updatedAt: input.now,
        });
        return serviceOk({
          attempt: cancelled,
          outcome: "cancelled",
          message: result.message,
        });
      }

      if (result.outcome !== "failed") {
        return serviceFail(validationError("Unsupported non-terminal transport result."));
      }

      const failureReceipt = receiptService.createReceipt({
        attempt: executing,
        receipt: result.receipt,
      });
      const policy = policyService.getPolicy(plan.deliveryType);
      if (!policy) {
        return serviceFail(validationError("Delivery policy is not configured."));
      }
      const retryable = result.retryable && executing.retryCount + 1 < policy.retry.maxAttempts;
      if (retryable) {
        const retry = await retryService.scheduleRetry({
          deliveryPlan: plan,
          attempt: executing,
          failureCode: result.failureCode,
          failureReason: result.failureReason,
          now: input.now,
          enqueueRuntimeJob: input.enqueueRuntimeJob,
        });
        if (!retry.ok) {
          return retry;
        }
        const retryScheduled = await saveAttempt(attempts, completeAttempt(executing, input.now, "retry_scheduled", failureReceipt, {
          nextRetryAt: retry.value.nextRetryAt,
          failureCode: result.failureCode,
          failureReason: result.failureReason,
        }));
        const event = await recordTransportEvent(domainEvents, {
          organizationId: plan.organizationId,
          workOrderId: plan.targetEntityId,
          now: input.now,
          correlationId: retryScheduled.correlationId,
          reason: result.failureReason,
          type: "transport_attempt_retry_scheduled",
          summary: `Transport attempt ${retryScheduled.id} scheduled retry ${retry.value.nextAttemptNumber}.`,
          attempt: retryScheduled,
          payload: {
            ...baseAttemptPayload(retryScheduled),
            nextRetryAt: retryScheduled.nextRetryAt,
            nextAttemptNumber: retry.value.nextAttemptNumber,
            failureCode: retryScheduled.failureCode,
            failureReason: retryScheduled.failureReason,
          },
        });
        await appendRecordedEvent(attempts, retryScheduled, event);
        await repositories.deliveryPlans.save({
          ...plan,
          status: DELIVERY_PLAN_STATUSES.Scheduled,
          activeRuntimeJobId: retry.value.runtimeJobId,
          nextAttemptAt: retry.value.nextRetryAt,
          retryCount: retry.value.nextAttemptNumber,
          updatedAt: input.now,
        });
        return serviceOk({
          attempt: retryScheduled,
          outcome: "retry_scheduled",
          message: result.message,
        });
      }

      const failed = await saveAttempt(attempts, completeAttempt(executing, input.now, "failed", failureReceipt, {
        failureCode: result.failureCode,
        failureReason: result.failureReason,
      }));
      const event = await recordTransportEvent(domainEvents, {
        organizationId: plan.organizationId,
        workOrderId: plan.targetEntityId,
        now: input.now,
        correlationId: failed.correlationId,
        reason: result.failureReason,
        type: "transport_attempt_failed",
        summary: `Transport attempt ${failed.id} failed.`,
        attempt: failed,
        payload: {
          ...baseAttemptPayload(failed),
          failureCode: failed.failureCode,
          failureReason: failed.failureReason,
        },
      });
      await appendRecordedEvent(attempts, failed, event);
      await repositories.deliveryPlans.save({
        ...plan,
        status: DELIVERY_PLAN_STATUSES.Failed,
        activeRuntimeJobId: null,
        nextAttemptAt: null,
        retryCount: failed.retryCount,
        updatedAt: input.now,
      });
      return serviceOk({
        attempt: failed,
        outcome: "failed",
        message: result.message,
      });
    },
  };
}

async function createAttempt(
  repository: TransportAttemptRepository,
  plan: DeliveryPlan,
  input: {
    now: IsoDateTimeString;
    adapterType: DeliveryAttempt["adapterType"];
    sourceEventId: string;
    correlationId: string;
    causationId: string;
    idempotencyKey: string;
    retryCount: number;
  },
): Promise<DeliveryAttempt> {
  const attempt: DeliveryAttempt = {
    id: repository.newId(),
    organizationId: plan.organizationId,
    tenantId: plan.organizationId,
    deliveryPlanId: plan.id,
    deliveryType: plan.deliveryType,
    channel: plan.channel,
    adapterType: input.adapterType,
    sourceEventId: input.sourceEventId,
    correlationId: input.correlationId,
    causationId: input.causationId,
    idempotencyKey: input.idempotencyKey,
    status: "queued",
    providerMessageId: null,
    providerCorrelationId: null,
    providerReceiptId: null,
    retryCount: input.retryCount,
    nextRetryAt: null,
    executionStartedAt: null,
    executionCompletedAt: null,
    failureCode: null,
    failureReason: null,
    emittedEventIds: [],
    createdAt: input.now,
    updatedAt: input.now,
  };
  await repository.create(attempt);
  return attempt;
}

async function saveAttempt(
  repository: TransportAttemptRepository,
  attempt: DeliveryAttempt,
): Promise<DeliveryAttempt> {
  await repository.save(attempt);
  return attempt;
}

function completeAttempt(
  attempt: DeliveryAttempt,
  now: IsoDateTimeString,
  status: DeliveryAttempt["status"],
  receipt: DeliveryReceipt,
  details: {
    nextRetryAt?: IsoDateTimeString | null;
    failureCode?: string | null;
    failureReason?: string | null;
  } = {},
): DeliveryAttempt {
  return {
    ...attempt,
    status,
    providerMessageId: receipt.providerMessageId,
    providerCorrelationId: receipt.providerCorrelationId,
    providerReceiptId: receipt.providerReceiptId,
    nextRetryAt: details.nextRetryAt ?? null,
    executionCompletedAt: now,
    failureCode: details.failureCode ?? null,
    failureReason: details.failureReason ?? null,
    updatedAt: now,
  };
}

async function appendRecordedEvent(
  repository: TransportAttemptRepository,
  attempt: DeliveryAttempt,
  event: Awaited<ReturnType<DomainEventService["record"]>>,
) {
  if (!event.ok) {
    return;
  }
  await repository.save({
    ...attempt,
    emittedEventIds: [...attempt.emittedEventIds, event.value.id],
  });
}

function baseAttemptPayload(attempt: DeliveryAttempt) {
  return {
    deliveryAttemptId: attempt.id,
    deliveryPlanId: attempt.deliveryPlanId,
    deliveryType: attempt.deliveryType,
    channel: attempt.channel,
    adapterType: attempt.adapterType,
    status: attempt.status,
    retryCount: attempt.retryCount,
  };
}

async function recordTransportEvent(
  domainEvents: DomainEventService,
  input: {
    organizationId: string;
    workOrderId: string;
    now: IsoDateTimeString;
    correlationId: string;
    reason: string | null | undefined;
    type:
      | "transport_attempt_queued"
      | "transport_attempt_executing"
      | "transport_attempt_succeeded"
      | "transport_attempt_failed"
      | "transport_attempt_retry_scheduled"
      | "transport_attempt_cancelled"
      | "transport_attempt_suppressed"
      | "transport_attempt_noop";
    summary: string;
    attempt: DeliveryAttempt;
    payload: Record<string, unknown>;
  },
) {
  return domainEvents.record({
    organizationId: input.organizationId,
    actor: { userId: "system", role: "system" },
    requestId: input.attempt.id,
    now: input.now,
    workOrderId: input.workOrderId,
    type: input.type,
    visibility: "internal",
    lifecycleStatus: null,
    entity: {
      entityType: "delivery_attempt",
      entityId: input.attempt.id,
      label: input.attempt.adapterType,
    },
    summary: input.summary,
    correlationId: input.correlationId,
    reason: input.reason ?? null,
    payload: input.payload as never,
  });
}

async function recordDeliveryCompletion(
  domainEvents: DomainEventService,
  plan: DeliveryPlan,
  now: IsoDateTimeString,
  reason: string,
) {
  return domainEvents.record({
    organizationId: plan.organizationId,
    actor: { userId: "system", role: "system" },
    requestId: plan.id,
    now,
    workOrderId: plan.targetEntityId,
    type: "delivery_completed",
    visibility: "internal",
    lifecycleStatus: null,
    entity: {
      entityType: "delivery_plan",
      entityId: plan.id,
      label: plan.deliveryType,
    },
    summary: `Delivery plan ${plan.id} completed transport execution.`,
    correlationId: plan.correlationId,
    reason,
    payload: {
      deliveryPlanId: plan.id,
      deliveryType: plan.deliveryType,
      sourceEscalationId: plan.sourceEscalationId,
      sourceEscalationStageNumber: plan.sourceEscalationStageNumber,
      targetEntityType: plan.targetEntityType,
      targetEntityId: plan.targetEntityId,
      recipientType: plan.recipientType,
      recipientId: plan.recipientId,
      channel: plan.channel,
      status: "completed",
      retryCount: plan.retryCount,
    } as never,
  });
}

async function upsertSuppressedOrCancelledAttempt(input: {
  attempt: DeliveryAttempt | null;
  attempts: TransportAttemptRepository;
  plan: DeliveryPlan;
  now: IsoDateTimeString;
  status: "cancelled" | "suppressed";
  reason: string;
  adapterType: DeliveryAttempt["adapterType"];
  sourceEventId: string;
  correlationId: string;
  causationId: string;
  idempotencyKey: string;
  domainEvents: DomainEventService;
}): Promise<DeliveryAttempt> {
  const attempt =
    input.attempt ??
    ({
      id: input.attempts.newId(),
      organizationId: input.plan.organizationId,
      tenantId: input.plan.organizationId,
      deliveryPlanId: input.plan.id,
      deliveryType: input.plan.deliveryType,
      channel: input.plan.channel,
      adapterType: input.adapterType,
      sourceEventId: input.sourceEventId,
      correlationId: input.correlationId,
      causationId: input.causationId,
      idempotencyKey: input.idempotencyKey,
      status: input.status,
      providerMessageId: null,
      providerCorrelationId: null,
      providerReceiptId: null,
      retryCount: 0,
      nextRetryAt: null,
      executionStartedAt: null,
      executionCompletedAt: input.now,
      failureCode: null,
      failureReason: input.reason,
      emittedEventIds: [],
      createdAt: input.now,
      updatedAt: input.now,
    } satisfies DeliveryAttempt);
  if (!input.attempt) {
    await input.attempts.create(attempt);
  } else {
    await input.attempts.save({
      ...input.attempt,
      status: input.status,
      executionCompletedAt: input.now,
      failureReason: input.reason,
      updatedAt: input.now,
    });
  }
  const current = input.attempt ? { ...input.attempt, status: input.status, executionCompletedAt: input.now, failureReason: input.reason, updatedAt: input.now } : attempt;
  await appendRecordedEvent(input.attempts, current, await recordTransportEvent(input.domainEvents, {
    organizationId: input.plan.organizationId,
    workOrderId: input.plan.targetEntityId,
    now: input.now,
    correlationId: current.correlationId,
    reason: input.reason,
    type: input.status === "cancelled" ? "transport_attempt_cancelled" : "transport_attempt_suppressed",
    summary:
      input.status === "cancelled"
        ? `Transport attempt ${current.id} cancelled before execution.`
        : `Transport attempt ${current.id} suppressed before execution.`,
    attempt: current,
    payload: {
      ...baseAttemptPayload(current),
      reason: input.reason,
    },
  }));
  return current;
}

export function buildTransportAttemptIdempotencyKey(
  deliveryPlanId: EntityId,
  attemptNumber: number,
): string {
  return ["delivery.attempt", deliveryPlanId, String(attemptNumber)].join(":");
}
