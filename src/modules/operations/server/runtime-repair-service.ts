import "server-only";

import {
  REPAIR_CONFIRMATION_STATUSES,
} from "@/modules/scheduler/domain/operator-guardrail";
import {
  createOperatorGuardrailService,
  type OperatorGuardrailService,
} from "@/modules/scheduler/server/operator-guardrail-service";
import type { SchedulerRepositories } from "@/modules/scheduler/server/scheduler-task-repository";
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
    reason?: string | null;
    dryRun?: boolean;
    now?: string;
  }): Promise<ServiceResult<RuntimeRepairAction>>;
  confirm(input: {
    organizationId: string;
    actor: ServiceActor;
    confirmationId: string;
    reason?: string | null;
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
  schedulerRepositories: SchedulerRepositories,
  guardrails: OperatorGuardrailService = createOperatorGuardrailService(schedulerRepositories),
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
        [
          input.actionType,
          input.targetId,
          String(Boolean(input.force)),
          String(Boolean(input.dryRun)),
        ].join(":");
      const existing = await observabilityRepositories.repairActions.findByIdempotencyKey({
        organizationId: input.organizationId,
        idempotencyKey,
      });
      if (existing) {
        return serviceOk(existing);
      }
      const guardrail = guardrails.validateRequest({
        actionType: input.actionType,
        batchSize: 1,
        reason: input.reason,
        dryRun: input.dryRun,
      });
      if (!guardrail.ok) {
        return guardrail;
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
          dryRun: Boolean(input.dryRun),
          reason: input.reason?.trim() || null,
        },
        result: {},
        requestedAt: timestamp,
        completedAt: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

      if (input.dryRun) {
        return completeAction(observabilityRepositories, requested, {
          status: RUNTIME_REPAIR_ACTION_STATUSES.Noop,
          summary: `Dry run completed for ${input.actionType}. No runtime mutation was executed.`,
          result: {
            dryRun: true,
            targetId: input.targetId,
          },
          completedAt: timestamp,
        });
      }

      if (guardrail.value.confirmationRequired) {
        const confirmation = await guardrails.ensureConfirmation({
          action: requested,
          actor: input.actor,
          targetIds: [input.targetId],
          reason: input.reason,
          dryRun: false,
          now: timestamp,
        });
        if (!confirmation.ok) {
          return confirmation;
        }
        return saveAction(observabilityRepositories, {
          ...requested,
          status: RUNTIME_REPAIR_ACTION_STATUSES.PendingConfirmation,
          summary: "Repair action is pending explicit operator confirmation.",
          metadata: {
            ...requested.metadata,
            confirmationId: confirmation.value.id,
            riskLevel: confirmation.value.riskLevel,
          },
          updatedAt: timestamp,
        });
      }

      return performRepairAction({
        requested,
        force: input.force,
        timestamp,
      });
    },
    async confirm(input) {
      const timestamp = input.now ?? nowIso();
      const confirmation = await guardrails.approveConfirmation({
        organizationId: input.organizationId,
        confirmationId: input.confirmationId,
        actor: input.actor,
        reason: input.reason,
        now: timestamp,
      });
      if (!confirmation.ok) {
        return confirmation;
      }
      const action = await observabilityRepositories.repairActions.getById(
        confirmation.value.repairActionId,
      );
      if (!action || action.organizationId !== input.organizationId) {
        return serviceFail(notFoundError("Pending repair action not found for confirmation."));
      }
      if (
        action.status !== RUNTIME_REPAIR_ACTION_STATUSES.PendingConfirmation &&
        action.status !== RUNTIME_REPAIR_ACTION_STATUSES.Requested
      ) {
        return serviceOk(action);
      }

      const result = await performRepairAction({
        requested: {
          ...action,
          status: RUNTIME_REPAIR_ACTION_STATUSES.Requested,
          updatedAt: timestamp,
          metadata: {
            ...action.metadata,
            confirmationId: confirmation.value.id,
            approvalReason: input.reason?.trim() || confirmation.value.reason,
            approvedByUserId: input.actor.userId,
          },
        },
        force: Boolean(action.metadata.force),
        timestamp,
      });
      if (!result.ok) {
        return result;
      }
      await schedulerRepositories.confirmations.save({
        ...confirmation.value,
        status: REPAIR_CONFIRMATION_STATUSES.Executed,
        executedAt: timestamp,
        updatedAt: timestamp,
      });
      return result;
    },
  };

  async function performRepairAction(input: {
    requested: RuntimeRepairAction;
    force?: boolean;
    timestamp: string;
  }): Promise<ServiceResult<RuntimeRepairAction>> {
    try {
      switch (input.requested.actionType) {
        case RUNTIME_REPAIR_ACTION_TYPES.DeadLetterReplay: {
          const replayed = await deadLetterReplay.replay({
            organizationId: input.requested.organizationId,
            deadLetterId: input.requested.targetId,
            actor: { userId: input.requested.requestedByUserId, role: input.requested.requestedByRole },
            force: input.force,
            now: input.timestamp,
          });
          if (!replayed.ok) {
            return failAction(
              observabilityRepositories,
              input.requested,
              replayed.error.safeMessage,
              input.timestamp,
            );
          }
          return completeAction(observabilityRepositories, input.requested, {
            status: RUNTIME_REPAIR_ACTION_STATUSES.Completed,
            summary: "Dead-letter replay enqueued successfully.",
            result: {
              jobId: replayed.value.id,
            },
            completedAt: input.timestamp,
          });
        }
        case RUNTIME_REPAIR_ACTION_TYPES.StuckRuntimeRequeue: {
          const job = await repositories.runtimeJobs.getById(input.requested.targetId);
          if (!job || job.organizationId !== input.requested.organizationId) {
            return failAction(observabilityRepositories, input.requested, "Runtime job not found.", input.timestamp);
          }
          const isStuck =
            (job.status === "leased" || job.status === "running") &&
            job.leaseExpiresAt !== null &&
            job.leaseExpiresAt <= input.timestamp;
          if (!isStuck && !input.force) {
            return completeAction(observabilityRepositories, input.requested, {
              status: RUNTIME_REPAIR_ACTION_STATUSES.Noop,
              summary: "Runtime job is not currently stuck.",
              result: {
                jobId: job.id,
              },
              completedAt: input.timestamp,
            });
          }
          const requeued = await services.runtime.jobs.enqueue({
            organizationId: input.requested.organizationId,
            actor: { userId: input.requested.requestedByUserId, role: input.requested.requestedByRole },
            now: input.timestamp,
            type: job.type,
            payloadVersion: job.payloadVersion,
            payload: {
              ...job.payload,
              repairOf: {
                runtimeJobId: job.id,
                repairedAt: input.timestamp,
              },
            },
            idempotencyKey: `${input.requested.idempotencyKey}:enqueue`,
            correlationId: job.correlationId,
            causationId: input.requested.id,
            sourceEventId: job.sourceEventId,
            maxAttempts: job.maxAttempts,
            runAfter: input.timestamp,
          });
          if (!requeued.ok) {
            return failAction(
              observabilityRepositories,
              input.requested,
              requeued.error.safeMessage,
              input.timestamp,
            );
          }
          return completeAction(observabilityRepositories, input.requested, {
            status: RUNTIME_REPAIR_ACTION_STATUSES.Completed,
            summary: "Stuck runtime job was requeued safely.",
            result: {
              originalJobId: job.id,
              replayedJobId: requeued.value.id,
            },
            completedAt: input.timestamp,
          });
        }
        case RUNTIME_REPAIR_ACTION_TYPES.EventReplayRetry: {
          const replayed = await eventReplay.replay({
            organizationId: input.requested.organizationId,
            eventId: input.requested.targetId,
            force: input.force,
            now: input.timestamp,
          });
          if (!replayed.ok) {
            return failAction(
              observabilityRepositories,
              input.requested,
              replayed.error.safeMessage,
              input.timestamp,
            );
          }
          return completeAction(observabilityRepositories, input.requested, {
            status: RUNTIME_REPAIR_ACTION_STATUSES.Completed,
            summary: "Durable event replay completed.",
            result: {
              processedCount: replayed.value.length,
            },
            completedAt: input.timestamp,
          });
        }
        case RUNTIME_REPAIR_ACTION_TYPES.ProviderReconciliationRetry: {
          const reconciled =
            await services.providerRuntime.reconciliation.reconcileReceipt({
              organizationId: input.requested.organizationId,
              receiptId: input.requested.targetId,
              now: input.timestamp,
            });
          if (!reconciled.ok) {
            return failAction(
              observabilityRepositories,
              input.requested,
              reconciled.error.safeMessage,
              input.timestamp,
            );
          }
          return completeAction(observabilityRepositories, input.requested, {
            status: RUNTIME_REPAIR_ACTION_STATUSES.Completed,
            summary: "Provider reconciliation retried successfully.",
            result: {
              receiptId: reconciled.value.receiptId,
              status: reconciled.value.status,
              reason: reconciled.value.reason,
            },
            completedAt: input.timestamp,
          });
        }
        case RUNTIME_REPAIR_ACTION_TYPES.DeliveryRetryReset: {
          const plan = await repositories.deliveryPlans.getById(input.requested.targetId);
          if (!plan || plan.organizationId !== input.requested.organizationId) {
            return failAction(observabilityRepositories, input.requested, "Delivery plan not found.", input.timestamp);
          }
          if (plan.status === "completed" || plan.status === "cancelled" || plan.status === "suppressed") {
            return completeAction(observabilityRepositories, input.requested, {
              status: RUNTIME_REPAIR_ACTION_STATUSES.Noop,
              summary: "Delivery plan is terminal and cannot be reset.",
              result: {
                deliveryPlanId: plan.id,
                status: plan.status,
              },
              completedAt: input.timestamp,
            });
          }
          const attempts = await transportAttempts.listByDeliveryPlanId({
            organizationId: input.requested.organizationId,
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
            now: input.timestamp,
          });
          if (!scheduled.ok) {
            return failAction(
              observabilityRepositories,
              input.requested,
              scheduled.error.safeMessage,
              input.timestamp,
            );
          }
          const queued = await services.runtime.jobs.enqueue({
            organizationId: input.requested.organizationId,
            actor: { userId: input.requested.requestedByUserId, role: input.requested.requestedByRole },
            now: input.timestamp,
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
            causationId: input.requested.id,
            sourceEventId: scheduled.value.sourceEventId,
            runAfter: input.timestamp,
            maxAttempts: 1,
          });
          if (!queued.ok) {
            return failAction(
              observabilityRepositories,
              input.requested,
              queued.error.safeMessage,
              input.timestamp,
            );
          }
          return completeAction(observabilityRepositories, input.requested, {
            status: RUNTIME_REPAIR_ACTION_STATUSES.Completed,
            summary: "Delivery retry reset queued a new transport execution attempt.",
            result: {
              deliveryPlanId: scheduled.value.id,
              runtimeJobId: queued.value.id,
              attemptNumber: nextAttemptNumber,
            },
            completedAt: input.timestamp,
          });
        }
        default:
          return serviceFail(validationError("Unsupported repair action."));
      }
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : "Unexpected runtime repair failure.";
      return failAction(observabilityRepositories, input.requested, safeMessage, input.timestamp);
    }
  }
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

async function saveAction(
  repositories: RuntimeObservabilityRepositories,
  action: RuntimeRepairAction,
): Promise<ServiceResult<RuntimeRepairAction>> {
  return serviceOk(await repositories.repairActions.save(action));
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
