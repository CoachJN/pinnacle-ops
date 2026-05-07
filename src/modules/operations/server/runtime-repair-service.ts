import "server-only";

import { createDeadLetterReplayService } from "@/modules/runtime/server/dead-letter-replay-service";
import { createEventReplayService } from "@/modules/runtime/server/event-replay-service";
import { createTransportAttemptRepository, buildTransportAttemptJobIdempotencyKey } from "@/modules/transport";
import type { FirestoreRepositories } from "@/server/repositories";
import type { DomainServices, ServiceActor } from "@/server/services";
import { serviceFail, serviceOk, type ServiceResult } from "@/server/services";
import { notFoundError, validationError } from "@/server/services/errors";
import { nowIso } from "@/server/services/types";
import {
  RUNTIME_REPAIR_ACTION_STATUSES,
  RUNTIME_REPAIR_ACTION_TYPES,
  type RuntimeRepairAction,
  type RuntimeRepairActionType,
} from "../domain/runtime-repair-action";
import type { RuntimeObservabilityRepositories } from "./runtime-observability-repository";

export interface RuntimeRepairService {
  execute(input: {
    organizationId: string;
    actor: ServiceActor;
    actionType: RuntimeRepairActionType;
    targetId: string;
    idempotencyKey?: string;
    force?: boolean;
    now?: string;
  }): Promise<ServiceResult<RuntimeRepairAction>>;
}

export function createRuntimeRepairService(
  repositories: Pick<
    FirestoreRepositories,
    | "domainEvents"
    | "runtimeJobs"
    | "runtimeDeadLetters"
    | "deliveryPlans"
    | "deliveryAttempts"
  >,
  services: Pick<DomainServices, "runtime" | "providerRuntime" | "delivery">,
  observabilityRepositories: RuntimeObservabilityRepositories,
): RuntimeRepairService {
  const deadLetterReplay = createDeadLetterReplayService(
    {
      runtimeDeadLetters: repositories.runtimeDeadLetters,
      runtimeJobs: repositories.runtimeJobs,
    },
    services.runtime.jobs,
  );
  const eventReplay = createEventReplayService(
    { domainEvents: repositories.domainEvents },
    services.runtime.subscribers,
  );
  const transportAttempts = createTransportAttemptRepository({
    deliveryAttempts: repositories.deliveryAttempts,
  });

  return {
    async execute(input) {
      const timestamp = input.now ?? nowIso();
      const idempotencyKey =
        input.idempotencyKey ??
        [input.actionType, input.targetId, String(Boolean(input.force))].join(":");
      const existing = await observabilityRepositories.repairActions.findByIdempotencyKey({
        organizationId: input.organizationId,
        idempotencyKey,
      });
      if (existing) {
        return serviceOk(existing);
      }

      const requested = await observabilityRepositories.repairActions.create({
        id: observabilityRepositories.repairActions.newId(),
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        actionType: input.actionType,
        status: RUNTIME_REPAIR_ACTION_STATUSES.Requested,
        targetType: targetTypeForAction(input.actionType),
        targetId: input.targetId,
        idempotencyKey,
        correlationId: `runtime-repair:${input.organizationId}:${input.actionType}:${input.targetId}`,
        causationId: `${input.actionType}:${input.targetId}`,
        sourceEventId: null,
        requestedByUserId: input.actor.userId,
        requestedByRole: input.actor.role,
        summary: `Requested runtime repair action ${input.actionType}.`,
        metadata: {
          force: Boolean(input.force),
        },
        result: {},
        requestedAt: timestamp,
        completedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      try {
        switch (input.actionType) {
          case RUNTIME_REPAIR_ACTION_TYPES.DeadLetterReplay: {
            const replayed = await deadLetterReplay.replay({
              organizationId: input.organizationId,
              deadLetterId: input.targetId,
              actor: input.actor,
              force: input.force,
              now: timestamp,
            });
            if (!replayed.ok) {
              return failAction(
                observabilityRepositories,
                requested,
                replayed.error.safeMessage,
                timestamp,
              );
            }
            return completeAction(observabilityRepositories, requested, {
              status: RUNTIME_REPAIR_ACTION_STATUSES.Completed,
              summary: "Dead-letter replay enqueued successfully.",
              result: {
                jobId: replayed.value.id,
              },
              completedAt: timestamp,
            });
          }
          case RUNTIME_REPAIR_ACTION_TYPES.StuckRuntimeRequeue: {
            const job = await repositories.runtimeJobs.getById(input.targetId);
            if (!job || job.organizationId !== input.organizationId) {
              return failAction(observabilityRepositories, requested, "Runtime job not found.", timestamp);
            }
            const isStuck =
              (job.status === "leased" || job.status === "running") &&
              job.leaseExpiresAt !== null &&
              job.leaseExpiresAt <= timestamp;
            if (!isStuck && !input.force) {
              return completeAction(observabilityRepositories, requested, {
                status: RUNTIME_REPAIR_ACTION_STATUSES.Noop,
                summary: "Runtime job is not currently stuck.",
                result: {
                  jobId: job.id,
                },
                completedAt: timestamp,
              });
            }
            const requeued = await services.runtime.jobs.enqueue({
              organizationId: input.organizationId,
              actor: input.actor,
              now: timestamp,
              type: job.type,
              payloadVersion: job.payloadVersion,
              payload: {
                ...job.payload,
                repairOf: {
                  runtimeJobId: job.id,
                  repairedAt: timestamp,
                },
              },
              idempotencyKey: `${idempotencyKey}:enqueue`,
              correlationId: job.correlationId,
              causationId: requested.id,
              sourceEventId: job.sourceEventId,
              maxAttempts: job.maxAttempts,
              runAfter: timestamp,
            });
            if (!requeued.ok) {
              return failAction(
                observabilityRepositories,
                requested,
                requeued.error.safeMessage,
                timestamp,
              );
            }
            return completeAction(observabilityRepositories, requested, {
              status: RUNTIME_REPAIR_ACTION_STATUSES.Completed,
              summary: "Stuck runtime job was requeued safely.",
              result: {
                originalJobId: job.id,
                replayedJobId: requeued.value.id,
              },
              completedAt: timestamp,
            });
          }
          case RUNTIME_REPAIR_ACTION_TYPES.EventReplayRetry: {
            const replayed = await eventReplay.replay({
              organizationId: input.organizationId,
              eventId: input.targetId,
              force: input.force,
              now: timestamp,
            });
            if (!replayed.ok) {
              return failAction(
                observabilityRepositories,
                requested,
                replayed.error.safeMessage,
                timestamp,
              );
            }
            return completeAction(observabilityRepositories, requested, {
              status: RUNTIME_REPAIR_ACTION_STATUSES.Completed,
              summary: "Durable event replay completed.",
              result: {
                processedCount: replayed.value.length,
              },
              completedAt: timestamp,
            });
          }
          case RUNTIME_REPAIR_ACTION_TYPES.ProviderReconciliationRetry: {
            const reconciled =
              await services.providerRuntime.reconciliation.reconcileReceipt({
                organizationId: input.organizationId,
                receiptId: input.targetId,
                now: timestamp,
              });
            if (!reconciled.ok) {
              return failAction(
                observabilityRepositories,
                requested,
                reconciled.error.safeMessage,
                timestamp,
              );
            }
            return completeAction(observabilityRepositories, requested, {
              status: RUNTIME_REPAIR_ACTION_STATUSES.Completed,
              summary: "Provider reconciliation retried successfully.",
              result: {
                receiptId: reconciled.value.receiptId,
                status: reconciled.value.status,
                reason: reconciled.value.reason,
              },
              completedAt: timestamp,
            });
          }
          case RUNTIME_REPAIR_ACTION_TYPES.DeliveryRetryReset: {
            const plan = await repositories.deliveryPlans.getById(input.targetId);
            if (!plan || plan.organizationId !== input.organizationId) {
              return failAction(observabilityRepositories, requested, "Delivery plan not found.", timestamp);
            }
            if (plan.status === "completed" || plan.status === "cancelled" || plan.status === "suppressed") {
              return completeAction(observabilityRepositories, requested, {
                status: RUNTIME_REPAIR_ACTION_STATUSES.Noop,
                summary: "Delivery plan is terminal and cannot be reset.",
                result: {
                  deliveryPlanId: plan.id,
                  status: plan.status,
                },
                completedAt: timestamp,
              });
            }
            const attempts = await transportAttempts.listByDeliveryPlanId({
              organizationId: input.organizationId,
              deliveryPlanId: plan.id,
              limit: 100,
            });
            const maxAttemptNumber = attempts.reduce(
              (max: number, item) => Math.max(max, item.retryCount),
              plan.retryCount,
            );
            const nextAttemptNumber = maxAttemptNumber + 1;
            const scheduled = await services.delivery.scheduler.scheduleExecution({
              plan,
              now: timestamp,
            });
            if (!scheduled.ok) {
              return failAction(
                observabilityRepositories,
                requested,
                scheduled.error.safeMessage,
                timestamp,
              );
            }
            const queued = await services.runtime.jobs.enqueue({
              organizationId: input.organizationId,
              actor: input.actor,
              now: timestamp,
              type: "transport.execute",
              payloadVersion: "v1",
              payload: {
                payloadVersion: "v1",
                deliveryPlanId: scheduled.value.id,
                deliveryType: scheduled.value.deliveryType,
                attemptNumber: nextAttemptNumber,
                reason: "operator_delivery_retry_reset",
                triggerEventType: "transport_attempt_retry_scheduled",
              },
              idempotencyKey: buildTransportAttemptJobIdempotencyKey(
                scheduled.value.id,
                nextAttemptNumber,
              ),
              correlationId: scheduled.value.correlationId,
              causationId: requested.id,
              sourceEventId: scheduled.value.sourceEventId,
              runAfter: timestamp,
              maxAttempts: 1,
            });
            if (!queued.ok) {
              return failAction(
                observabilityRepositories,
                requested,
                queued.error.safeMessage,
                timestamp,
              );
            }
            return completeAction(observabilityRepositories, requested, {
              status: RUNTIME_REPAIR_ACTION_STATUSES.Completed,
              summary: "Delivery retry reset queued a new transport execution attempt.",
              result: {
                deliveryPlanId: scheduled.value.id,
                runtimeJobId: queued.value.id,
                attemptNumber: nextAttemptNumber,
              },
              completedAt: timestamp,
            });
          }
          default:
            return serviceFail(validationError("Unsupported repair action."));
        }
      } catch (error) {
        const safeMessage = error instanceof Error ? error.message : "Unexpected runtime repair failure.";
        return failAction(observabilityRepositories, requested, safeMessage, timestamp);
      }
    },
  };
}

function targetTypeForAction(actionType: RuntimeRepairActionType): RuntimeRepairAction["targetType"] {
  switch (actionType) {
    case RUNTIME_REPAIR_ACTION_TYPES.DeadLetterReplay:
      return "runtime_dead_letter";
    case RUNTIME_REPAIR_ACTION_TYPES.StuckRuntimeRequeue:
      return "runtime_job";
    case RUNTIME_REPAIR_ACTION_TYPES.EventReplayRetry:
      return "domain_event";
    case RUNTIME_REPAIR_ACTION_TYPES.ProviderReconciliationRetry:
      return "provider_receipt";
    case RUNTIME_REPAIR_ACTION_TYPES.DeliveryRetryReset:
      return "delivery_plan";
  }
}

async function completeAction(
  repositories: RuntimeObservabilityRepositories,
  action: RuntimeRepairAction,
  patch: {
    status: RuntimeRepairAction["status"];
    summary: string;
    result: Record<string, unknown>;
    completedAt: string;
  },
): Promise<ServiceResult<RuntimeRepairAction>> {
  const saved = await repositories.repairActions.save({
    ...action,
    status: patch.status,
    summary: patch.summary,
    result: patch.result,
    completedAt: patch.completedAt,
    updatedAt: patch.completedAt,
  });
  return serviceOk(saved);
}

async function failAction(
  repositories: RuntimeObservabilityRepositories,
  action: RuntimeRepairAction,
  message: string,
  now: string,
): Promise<ServiceResult<RuntimeRepairAction>> {
  const saved = await repositories.repairActions.save({
    ...action,
    status: RUNTIME_REPAIR_ACTION_STATUSES.Failed,
    summary: message,
    result: {
      error: message,
    },
    completedAt: now,
    updatedAt: now,
  });
  return serviceOk(saved);
}
