import "server-only";

import {
  DELIVERY_PLAN_STATUSES,
  DELIVERY_TYPES,
  type DeliveryPlan,
  type DeliveryPlanProcessJobPayload,
} from "@/modules/delivery";
import type { EscalationOrchestration } from "@/modules/escalation";
import type { FirestoreRepositories } from "@/server/repositories";
import type { DomainEventService } from "@/server/services";
import { serviceFail, serviceOk, type ServiceResult } from "@/server/services";
import { notFoundError, validationError } from "@/server/services/errors";
import type { IsoDateTimeString } from "@/types/entity";
import type { DeliveryPlanRepository } from "./delivery-plan-repository";
import type { DeliveryPolicyService } from "./delivery-policy-service";
import type { DeliveryRecipientService } from "./delivery-recipient-service";
import type { DeliverySchedulerService } from "./delivery-scheduler-service";
import type { DeliverySuppressionService } from "./delivery-suppression-service";

export interface DeliveryRuntimeService {
  processJob(input: {
    organizationId: string;
    payload: DeliveryPlanProcessJobPayload;
    runtimeJobId: string;
    correlationId: string;
    causationId: string;
    sourceEventId: string | null;
    now: IsoDateTimeString;
  }): Promise<
    ServiceResult<{
      plans: readonly DeliveryPlan[];
      outcome:
        | "planned"
        | "scheduled"
        | "cancelled"
        | "suppressed"
        | "noop_stale"
        | "noop_duplicate";
      message: string;
    }>
  >;
}

export function createDeliveryRuntimeService(
  repositories: Pick<
    FirestoreRepositories,
    "deliveryPlans" | "domainEvents" | "escalationOrchestrations" | "workOrders" | "userProfiles"
  >,
  repository: DeliveryPlanRepository,
  policyService: DeliveryPolicyService,
  recipientService: DeliveryRecipientService,
  scheduler: DeliverySchedulerService,
  suppression: DeliverySuppressionService,
  domainEvents: DomainEventService,
): DeliveryRuntimeService {
  return {
    async processJob(input) {
      const policy = policyService.getPolicy(input.payload.deliveryType);
      if (!policy) {
        return serviceFail(validationError("Delivery policy is not configured."));
      }

      if (input.payload.action === "cancel_for_escalation") {
        if (!input.payload.sourceEscalationId) {
          return serviceFail(validationError("sourceEscalationId is required."));
        }
        const cancelled = await suppression.cancelForEscalation({
          organizationId: input.organizationId,
          sourceEscalationId: input.payload.sourceEscalationId,
          now: input.now,
          reason: input.payload.reason,
        });
        for (const plan of cancelled) {
          const recorded = await recordDeliveryEvent(domainEvents, {
            organizationId: plan.organizationId,
            workOrderId: plan.targetEntityId,
            now: input.now,
            correlationId: plan.correlationId,
            reason: plan.cancellationReason,
            type: "delivery_cancelled",
            summary: `Delivery plan ${plan.id} cancelled.`,
            plan,
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
              status: plan.status,
              retryCount: plan.retryCount,
              cancellationReason: plan.cancellationReason,
            },
          });
          if (!recorded.ok) {
            return recorded;
          }
        }
        return serviceOk({
          plans: cancelled,
          outcome: cancelled.length > 0 ? "cancelled" : "noop_stale",
          message:
            cancelled.length > 0
              ? `Cancelled ${cancelled.length} delivery plans for escalation.`
              : "No active delivery plans matched the cancellation request.",
        });
      }

      if (!input.payload.sourceEscalationId || !input.payload.sourceEventId) {
        return serviceFail(validationError("Delivery planning source escalation and event ids are required."));
      }

      const escalation = await repositories.escalationOrchestrations.getById(input.payload.sourceEscalationId);
      if (!escalation || escalation.organizationId !== input.organizationId) {
        return serviceFail(notFoundError("Source escalation not found."));
      }
      if (escalation.escalationType !== policy.escalationType) {
        return serviceFail(validationError("Unsupported escalation type for delivery planning."));
      }

      const workOrder = await repositories.workOrders.getById(escalation.targetEntityId);
      if (!workOrder || workOrder.organizationId !== input.organizationId) {
        return serviceFail(notFoundError("Delivery plan target work order not found."));
      }

      const recipients = await recipientService.resolveRecipients({
        organizationId: input.organizationId,
        deliveryType: DELIVERY_TYPES.EscalationFirstResponseBreachNotification,
        workOrder,
      });

      const createdPlans: DeliveryPlan[] = [];
      for (const recipient of recipients) {
        const channel = policy.channelByRecipientType[recipient.recipientType];
        const duplicate = await suppression.findActiveForRecipient({
          organizationId: input.organizationId,
          deliveryType: input.payload.deliveryType,
          sourceEscalationId: escalation.id,
          sourceEscalationStageNumber: input.payload.sourceEscalationStageNumber ?? null,
          recipientId: recipient.recipientId,
          channel,
        });

        if (duplicate) {
          const suppressedIdempotencyKey = buildSuppressedPlanIdempotencyKey({
            deliveryType: input.payload.deliveryType,
            sourceEscalationId: escalation.id,
            sourceEscalationStageNumber: input.payload.sourceEscalationStageNumber ?? null,
            recipientId: recipient.recipientId,
            channel,
            sourceEventId: input.payload.sourceEventId,
            recipientType: recipient.recipientType,
          });
          const alreadySuppressed = await repository.findByIdempotencyKey({
            organizationId: input.organizationId,
            deliveryType: input.payload.deliveryType,
            idempotencyKey: suppressedIdempotencyKey,
          });
          if (!alreadySuppressed) {
            const suppressed: DeliveryPlan = {
              id: repository.newId(),
              organizationId: input.organizationId,
              tenantId: input.organizationId,
              deliveryType: input.payload.deliveryType,
              sourceEscalationId: escalation.id,
              sourceEscalationStageNumber: input.payload.sourceEscalationStageNumber ?? null,
              sourceEventId: input.payload.sourceEventId,
              correlationId: input.correlationId,
              causationId: input.causationId,
              idempotencyKey: suppressedIdempotencyKey,
              targetEntityType: "work_order",
              targetEntityId: workOrder.id,
              recipientType: recipient.recipientType,
              recipientId: recipient.recipientId,
              recipientAddress: recipient.recipientAddress,
              channel,
              templateId: policy.templateId,
              templateVersion: policy.templateVersion,
              priority: policy.priority,
              status: DELIVERY_PLAN_STATUSES.Suppressed,
              retryCount: 0,
              nextAttemptAt: null,
              suppressionReason: "duplicate_active_delivery_plan",
              cancellationReason: null,
              activeRuntimeJobId: null,
              noopCount: 1,
              createdAt: input.now,
              updatedAt: input.now,
            };
            await repository.create(suppressed);
            const suppressedEvent = await recordDeliveryEvent(domainEvents, {
              organizationId: suppressed.organizationId,
              workOrderId: suppressed.targetEntityId,
              now: input.now,
              correlationId: suppressed.correlationId,
              reason: suppressed.suppressionReason,
              type: "delivery_suppressed",
              summary: `Duplicate delivery plan for recipient ${suppressed.recipientId} suppressed.`,
              plan: suppressed,
              payload: {
                deliveryPlanId: suppressed.id,
                deliveryType: suppressed.deliveryType,
                sourceEscalationId: suppressed.sourceEscalationId,
                sourceEscalationStageNumber: suppressed.sourceEscalationStageNumber,
                targetEntityType: suppressed.targetEntityType,
                targetEntityId: suppressed.targetEntityId,
                recipientType: suppressed.recipientType,
                recipientId: suppressed.recipientId,
                channel: suppressed.channel,
                status: suppressed.status,
                retryCount: suppressed.retryCount,
                suppressionReason: suppressed.suppressionReason,
              },
            });
            if (!suppressedEvent.ok) {
              return suppressedEvent;
            }
            createdPlans.push(suppressed);
          }
          continue;
        }

        const activeIdempotencyKey = buildActivePlanIdempotencyKey({
          deliveryType: input.payload.deliveryType,
          sourceEscalationId: escalation.id,
          sourceEscalationStageNumber: input.payload.sourceEscalationStageNumber ?? null,
          recipientId: recipient.recipientId,
          channel,
        });
        const existingPlan = await repository.findByIdempotencyKey({
          organizationId: input.organizationId,
          deliveryType: input.payload.deliveryType,
          idempotencyKey: activeIdempotencyKey,
        });
        if (existingPlan) {
          createdPlans.push(existingPlan);
          continue;
        }

        const created: DeliveryPlan = {
          id: repository.newId(),
          organizationId: input.organizationId,
          tenantId: input.organizationId,
          deliveryType: input.payload.deliveryType,
          sourceEscalationId: escalation.id,
          sourceEscalationStageNumber: input.payload.sourceEscalationStageNumber ?? null,
          sourceEventId: input.payload.sourceEventId,
          correlationId: input.correlationId,
          causationId: input.causationId,
          idempotencyKey: activeIdempotencyKey,
          targetEntityType: "work_order",
          targetEntityId: workOrder.id,
          recipientType: recipient.recipientType,
          recipientId: recipient.recipientId,
          recipientAddress: recipient.recipientAddress,
          channel,
          templateId: policy.templateId,
          templateVersion: policy.templateVersion,
          priority: policy.priority,
          status: DELIVERY_PLAN_STATUSES.Planned,
          retryCount: 0,
          nextAttemptAt: null,
          suppressionReason: null,
          cancellationReason: null,
          activeRuntimeJobId: null,
          noopCount: 0,
          createdAt: input.now,
          updatedAt: input.now,
        };
        await repository.create(created);
        const planned = await recordDeliveryEvent(domainEvents, {
          organizationId: created.organizationId,
          workOrderId: created.targetEntityId,
          now: input.now,
          correlationId: created.correlationId,
          reason: input.payload.reason,
          type: "delivery_planned",
          summary: `Delivery plan ${created.id} created for recipient ${created.recipientId}.`,
          plan: created,
          payload: {
            deliveryPlanId: created.id,
            deliveryType: created.deliveryType,
            sourceEscalationId: created.sourceEscalationId,
            sourceEscalationStageNumber: created.sourceEscalationStageNumber,
            targetEntityType: created.targetEntityType,
            targetEntityId: created.targetEntityId,
            recipientType: created.recipientType,
            recipientId: created.recipientId,
            channel: created.channel,
            status: created.status,
            retryCount: created.retryCount,
          },
        });
        if (!planned.ok) {
          return planned;
        }

        const scheduled = await scheduler.scheduleExecution({
          plan: created,
          now: input.now,
        });
        if (!scheduled.ok) {
          return scheduled;
        }
        const scheduledEvent = await recordDeliveryEvent(domainEvents, {
          organizationId: scheduled.value.organizationId,
          workOrderId: scheduled.value.targetEntityId,
          now: input.now,
          correlationId: scheduled.value.correlationId,
          reason: "transport_execution_scheduled",
          type: "delivery_scheduled",
          summary: `Delivery plan ${scheduled.value.id} scheduled for transport execution.`,
          plan: scheduled.value,
          payload: {
            deliveryPlanId: scheduled.value.id,
            deliveryType: scheduled.value.deliveryType,
            sourceEscalationId: scheduled.value.sourceEscalationId,
            sourceEscalationStageNumber: scheduled.value.sourceEscalationStageNumber,
            targetEntityType: scheduled.value.targetEntityType,
            targetEntityId: scheduled.value.targetEntityId,
            recipientType: scheduled.value.recipientType,
            recipientId: scheduled.value.recipientId,
            channel: scheduled.value.channel,
            status: scheduled.value.status,
            retryCount: scheduled.value.retryCount,
            nextAttemptAt: scheduled.value.nextAttemptAt,
          },
        });
        if (!scheduledEvent.ok) {
          return scheduledEvent;
        }
        createdPlans.push(scheduled.value);
      }

      return serviceOk({
        plans: createdPlans,
        outcome: createdPlans.some((plan) => plan.status === "scheduled") ? "scheduled" : "planned",
        message: `Processed ${createdPlans.length} delivery plans from escalation event.`,
      });
    },
  };
}

async function incrementNoop(
  repository: DeliveryPlanRepository,
  plan: DeliveryPlan,
  now: IsoDateTimeString,
): Promise<DeliveryPlan> {
  const updated: DeliveryPlan = {
    ...plan,
    noopCount: plan.noopCount + 1,
    updatedAt: now,
  };
  await repository.save(updated);
  return updated;
}

function buildActivePlanIdempotencyKey(input: {
  deliveryType: DeliveryPlan["deliveryType"];
  sourceEscalationId: string;
  sourceEscalationStageNumber: number | null;
  recipientId: string;
  channel: DeliveryPlan["channel"];
}): string {
  return [
    "delivery.plan",
    input.deliveryType,
    input.sourceEscalationId,
    String(input.sourceEscalationStageNumber ?? 0),
    input.recipientId,
    input.channel,
  ].join(":");
}

function buildSuppressedPlanIdempotencyKey(input: {
  deliveryType: DeliveryPlan["deliveryType"];
  sourceEscalationId: string;
  sourceEscalationStageNumber: number | null;
  recipientId: string;
  channel: DeliveryPlan["channel"];
  sourceEventId: string;
  recipientType: DeliveryPlan["recipientType"];
}): string {
  return [
    buildActivePlanIdempotencyKey(input),
    "suppressed",
    input.recipientType,
    input.sourceEventId,
  ].join(":");
}

async function recordDeliveryEvent(
  domainEvents: DomainEventService,
  input: {
    organizationId: string;
    workOrderId: string;
    now: IsoDateTimeString;
    correlationId: string;
    reason: string | null | undefined;
    type:
      | "delivery_planned"
      | "delivery_scheduled"
      | "delivery_cancelled"
      | "delivery_suppressed";
    summary: string;
    plan: DeliveryPlan;
    payload: Record<string, unknown>;
  },
) {
  return domainEvents.record({
    organizationId: input.organizationId,
    actor: { userId: "system", role: "system" },
    requestId: input.plan.id,
    now: input.now,
    workOrderId: input.workOrderId,
    type: input.type,
    visibility: "internal",
    lifecycleStatus: null,
    entity: {
      entityType: "delivery_plan",
      entityId: input.plan.id,
      label: input.plan.deliveryType,
    },
    summary: input.summary,
    correlationId: input.correlationId,
    reason: input.reason ?? null,
    payload: input.payload as never,
  });
}
