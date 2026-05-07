import "server-only";

import {
  ESCALATION_ORCHESTRATION_STATUSES,
  ESCALATION_TYPES,
  type EscalationOrchestration,
  type EscalationProgressJobPayload,
} from "@/modules/escalation";
import type { FirestoreRepositories } from "@/server/repositories";
import type { DomainEventService } from "@/server/services";
import { serviceFail, serviceOk, type ServiceResult } from "@/server/services";
import { notFoundError, validationError } from "@/server/services/errors";
import type { IsoDateTimeString } from "@/types/entity";
import type { EscalationOrchestrationRepository } from "./escalation-orchestration-repository";
import type { EscalationPolicyService } from "./escalation-policy-service";
import type { EscalationProgressionService } from "./escalation-progression-service";
import type { EscalationSuppressionService } from "./escalation-suppression-service";

export interface EscalationRuntimeService {
  processJob(input: {
    organizationId: string;
    payload: EscalationProgressJobPayload;
    runtimeJobId: string;
    correlationId: string;
    causationId: string;
    sourceEventId: string | null;
    now: IsoDateTimeString;
    enqueueRuntimeJob: Parameters<EscalationProgressionService["progressToStage"]>[0]["enqueueRuntimeJob"];
  }): Promise<
    ServiceResult<{
      orchestration: EscalationOrchestration | null;
      outcome:
        | "created"
        | "progressed"
        | "cancelled"
        | "suppressed"
        | "noop_stale"
        | "noop_duplicate";
      message: string;
    }>
  >;
}

export function createEscalationRuntimeService(
  repositories: Pick<FirestoreRepositories, "slaTimers" | "workOrders">,
  repository: EscalationOrchestrationRepository,
  policyService: EscalationPolicyService,
  suppression: EscalationSuppressionService,
  progression: EscalationProgressionService,
  domainEvents: DomainEventService,
): EscalationRuntimeService {
  return {
    async processJob(input) {
      const policy = policyService.getPolicy(input.payload.escalationType);
      if (!policy) {
        return serviceFail(validationError("Escalation policy is not configured."));
      }
      if (input.payload.escalationType !== ESCALATION_TYPES.WorkOrderFirstResponseBreach) {
        return serviceFail(validationError("Unsupported escalation type."));
      }

      const timer = await repositories.slaTimers.getById(input.payload.sourceSlaTimerId);
      if (!timer || timer.organizationId !== input.organizationId) {
        return serviceFail(notFoundError("Source SLA timer not found."));
      }

      if (input.payload.action === "cancel_if_resolved") {
        const latest = await repository.findLatestByTimer({
          organizationId: input.organizationId,
          escalationType: input.payload.escalationType,
          sourceSlaTimerId: input.payload.sourceSlaTimerId,
        });
        if (!latest) {
          return serviceOk({
            orchestration: null,
            outcome: "noop_stale",
            message: "No escalation exists for the resolved SLA timer.",
          });
        }
        if (
          latest.status === ESCALATION_ORCHESTRATION_STATUSES.Cancelled ||
          latest.status === ESCALATION_ORCHESTRATION_STATUSES.Suppressed
        ) {
          return serviceOk({
            orchestration: latest,
            outcome: "noop_duplicate",
            message: `Escalation is already ${latest.status}.`,
          });
        }

        const workOrder = await repositories.workOrders.getById(latest.targetEntityId);
        const cancelled: EscalationOrchestration = {
          ...latest,
          status: ESCALATION_ORCHESTRATION_STATUSES.Cancelled,
          activeRuntimeJobId: null,
          nextStageAt: null,
          cancellationReason: input.payload.reason,
          resolvedAt: input.now,
          noopCount: latest.noopCount,
          updatedAt: input.now,
        };
        await repository.save(cancelled);
        const emitted = await domainEvents.record({
          organizationId: cancelled.organizationId,
          actor: { userId: "system", role: "system" },
          requestId: cancelled.id,
          now: input.now,
          workOrderId: cancelled.targetEntityType === "work_order" ? cancelled.targetEntityId : null,
          type: "escalation_cancelled",
          visibility: "internal",
          lifecycleStatus: workOrder?.lifecycleStatus ?? null,
          entity: {
            entityType: "escalation_orchestration",
            entityId: cancelled.id,
            label: cancelled.escalationType,
          },
          summary: `Escalation ${cancelled.escalationType} cancelled after SLA resolution.`,
          correlationId: cancelled.correlationId,
          reason: input.payload.reason,
          payload: {
            orchestrationId: cancelled.id,
            escalationType: cancelled.escalationType,
            targetEntityType: cancelled.targetEntityType,
            targetEntityId: cancelled.targetEntityId,
            sourceSlaTimerId: cancelled.sourceSlaTimerId,
            status: cancelled.status,
            cancellationReason: cancelled.cancellationReason,
          },
        });
        if (!emitted.ok) {
          return emitted;
        }

        return serviceOk({
          orchestration: cancelled,
          outcome: "cancelled",
          message: `Escalation cancelled after SLA resolution${workOrder ? "." : " (target missing)."}`,
        });
      }

      const existingByIdempotency = await repository.findByIdempotencyKey({
        organizationId: input.organizationId,
        escalationType: input.payload.escalationType,
        idempotencyKey: buildEscalationIdempotencyKey(
          input.payload.escalationType,
          input.payload.sourceSlaTimerId,
        ),
      });
      const open = await suppression.findOpenForCondition({
        organizationId: input.organizationId,
        escalationType: input.payload.escalationType,
        targetEntityType: input.payload.targetEntityType,
        targetEntityId: input.payload.targetEntityId,
      });

      let orchestration = existingByIdempotency;
      if (!orchestration && open) {
        const suppressed: EscalationOrchestration = {
          id: repository.newId(),
          organizationId: input.organizationId,
          tenantId: input.organizationId,
          escalationType: input.payload.escalationType,
          targetEntityType: input.payload.targetEntityType,
          targetEntityId: input.payload.targetEntityId,
          sourceSlaTimerId: input.payload.sourceSlaTimerId,
          sourceEventId: input.payload.sourceEventId,
          correlationId: input.correlationId,
          causationId: input.causationId,
          idempotencyKey: buildSuppressedEscalationIdempotencyKey(
            input.payload.escalationType,
            input.payload.sourceSlaTimerId,
            input.payload.sourceEventId,
          ),
          status: ESCALATION_ORCHESTRATION_STATUSES.Suppressed,
          currentStage: open.currentStage,
          stageHistory: [],
          activeRuntimeJobId: null,
          nextStageAt: null,
          suppressedReason: "duplicate_active_escalation",
          cancellationReason: null,
          resolvedAt: input.now,
          lastProgressedAt: null,
          progressionAttemptCount: 0,
          noopCount: 1,
          createdAt: input.now,
          updatedAt: input.now,
        };
        await repository.create(suppressed);
        const emitted = await domainEvents.record({
          organizationId: suppressed.organizationId,
          actor: { userId: "system", role: "system" },
          requestId: suppressed.id,
          now: input.now,
          workOrderId: suppressed.targetEntityType === "work_order" ? suppressed.targetEntityId : null,
          type: "escalation_suppressed",
          visibility: "internal",
          lifecycleStatus: null,
          entity: {
            entityType: "escalation_orchestration",
            entityId: suppressed.id,
            label: suppressed.escalationType,
          },
          summary: `Duplicate escalation ${suppressed.escalationType} suppressed.`,
          correlationId: suppressed.correlationId,
          reason: suppressed.suppressedReason,
          payload: {
            orchestrationId: suppressed.id,
            escalationType: suppressed.escalationType,
            targetEntityType: suppressed.targetEntityType,
            targetEntityId: suppressed.targetEntityId,
            sourceSlaTimerId: suppressed.sourceSlaTimerId,
            status: suppressed.status,
            suppressedReason: suppressed.suppressedReason,
          },
        });
        if (!emitted.ok) {
          return emitted;
        }
        return serviceOk({
          orchestration: suppressed,
          outcome: "suppressed",
          message: "Duplicate active escalation suppressed.",
        });
      }

      if (!orchestration) {
        orchestration = {
          id: repository.newId(),
          organizationId: input.organizationId,
          tenantId: input.organizationId,
          escalationType: input.payload.escalationType,
          targetEntityType: input.payload.targetEntityType,
          targetEntityId: input.payload.targetEntityId,
          sourceSlaTimerId: input.payload.sourceSlaTimerId,
          sourceEventId: input.payload.sourceEventId,
          correlationId: input.correlationId,
          causationId: input.causationId,
          idempotencyKey: buildEscalationIdempotencyKey(
            input.payload.escalationType,
            input.payload.sourceSlaTimerId,
          ),
          status: ESCALATION_ORCHESTRATION_STATUSES.Active,
          currentStage: null,
          stageHistory: [],
          activeRuntimeJobId: input.runtimeJobId,
          nextStageAt: null,
          suppressedReason: null,
          cancellationReason: null,
          resolvedAt: null,
          lastProgressedAt: null,
          progressionAttemptCount: 0,
          noopCount: 0,
          createdAt: input.now,
          updatedAt: input.now,
        };
        await repository.create(orchestration);
      }

      const progressed = await progression.progressToStage({
        orchestration,
        requestedStageNumber: input.payload.requestedStageNumber ?? 1,
        sourceEventId: input.payload.sourceEventId,
        reason: input.payload.reason,
        now: input.now,
        enqueueRuntimeJob: input.enqueueRuntimeJob,
      });
      if (!progressed.ok) {
        return progressed;
      }

      return serviceOk({
        orchestration: progressed.value.orchestration,
        outcome:
          orchestration.currentStage === null && !progressed.value.stale
            ? "created"
            : progressed.value.stale
              ? "noop_stale"
              : "progressed",
        message: progressed.value.message,
      });
    },
  };
}

export function buildEscalationIdempotencyKey(
  escalationType: string,
  sourceSlaTimerId: string,
): string {
  return `${escalationType}:timer:${sourceSlaTimerId}`;
}

function buildSuppressedEscalationIdempotencyKey(
  escalationType: string,
  sourceSlaTimerId: string,
  sourceEventId: string,
): string {
  return `${escalationType}:timer:${sourceSlaTimerId}:source:${sourceEventId}:suppressed`;
}
