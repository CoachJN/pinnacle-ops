import "server-only";

import {
  ESCALATION_ORCHESTRATION_STATUSES,
  type EscalationOrchestration,
  type EscalationStage,
} from "@/modules/escalation";
import type { FirestoreRepositories } from "@/server/repositories";
import type { DomainEventService } from "@/server/services";
import { serviceFail, serviceOk, type ServiceResult } from "@/server/services";
import { validationError } from "@/server/services/errors";
import type { IsoDateTimeString } from "@/types/entity";
import type { EscalationOrchestrationRepository } from "./escalation-orchestration-repository";
import type { EscalationPolicyService } from "./escalation-policy-service";
import type { EscalationSchedulerService } from "./escalation-scheduler-service";

export interface EscalationProgressionService {
  progressToStage(input: {
    orchestration: EscalationOrchestration;
    requestedStageNumber: number;
    sourceEventId: string;
    reason: string;
    now: IsoDateTimeString;
    enqueueRuntimeJob: Parameters<EscalationSchedulerService["scheduleNextStage"]>[0]["enqueueRuntimeJob"];
  }): Promise<
    ServiceResult<{
      orchestration: EscalationOrchestration;
      stale: boolean;
      message: string;
    }>
  >;
}

export function createEscalationProgressionService(
  repositories: Pick<FirestoreRepositories, "workOrders">,
  repository: EscalationOrchestrationRepository,
  policyService: EscalationPolicyService,
  scheduler: EscalationSchedulerService,
  domainEvents: DomainEventService,
): EscalationProgressionService {
  return {
    async progressToStage(input) {
      const policy = policyService.getPolicy(input.orchestration.escalationType);
      if (!policy) {
        return serviceFail(validationError("Escalation policy is not configured."));
      }

      if (
        input.orchestration.status === ESCALATION_ORCHESTRATION_STATUSES.Cancelled ||
        input.orchestration.status === ESCALATION_ORCHESTRATION_STATUSES.Failed
      ) {
        return serviceOk({
          orchestration: incrementNoop(input.orchestration, input.now),
          stale: true,
          message: `Escalation is already ${input.orchestration.status}.`,
        });
      }

      const existingStage = input.orchestration.currentStage?.stageNumber ?? 0;
      if (existingStage >= input.requestedStageNumber) {
        const stale = incrementNoop(input.orchestration, input.now);
        await repository.save(stale);
        return serviceOk({
          orchestration: stale,
          stale: true,
          message: "Escalation stage already applied.",
        });
      }

      const stageDefinition = policy.stages.find((stage) => stage.stageNumber === input.requestedStageNumber);
      if (!stageDefinition) {
        return serviceFail(validationError("Requested escalation stage is not defined."));
      }

      const workOrder = await repositories.workOrders.getById(input.orchestration.targetEntityId);
      const lifecycleStatus = workOrder?.lifecycleStatus ?? null;
      const completedStage = input.orchestration.stageHistory[input.orchestration.stageHistory.length - 1] ?? null;
      if (completedStage && completedStage.completedAt === null) {
        completedStage.completedAt = input.now;
      }

      const nextStage: EscalationStage = {
        stageNumber: stageDefinition.stageNumber,
        stageName: stageDefinition.stageName,
        enteredAt: input.now,
        completedAt: null,
        progressionReason: input.reason,
        emittedEventIds: [],
        scheduledRuntimeJobIds: [],
      };

      const progressedBase: EscalationOrchestration = {
        ...input.orchestration,
        status:
          stageDefinition.stageNumber === policy.stages[policy.stages.length - 1]?.stageNumber
            ? ESCALATION_ORCHESTRATION_STATUSES.Completed
            : ESCALATION_ORCHESTRATION_STATUSES.Active,
        currentStage: {
          stageNumber: nextStage.stageNumber,
          stageName: nextStage.stageName,
        },
        stageHistory: [...input.orchestration.stageHistory, nextStage],
        activeRuntimeJobId: null,
        nextStageAt: null,
        suppressedReason: null,
        cancellationReason: null,
        lastProgressedAt: input.now,
        progressionAttemptCount: input.orchestration.progressionAttemptCount + 1,
        updatedAt: input.now,
      };

      const eventType = existingStage === 0 ? "escalation_created" : "escalation_progressed";
      const recorded = await domainEvents.record({
        organizationId: progressedBase.organizationId,
        actor: { userId: "system", role: "system" },
        requestId: progressedBase.id,
        now: input.now,
        workOrderId: progressedBase.targetEntityType === "work_order" ? progressedBase.targetEntityId : null,
        type: eventType,
        visibility: "internal",
        lifecycleStatus,
        entity: {
          entityType: "escalation_orchestration",
          entityId: progressedBase.id,
          label: progressedBase.escalationType,
        },
        summary:
          existingStage === 0
            ? `Escalation ${progressedBase.escalationType} created at stage ${nextStage.stageNumber}.`
            : `Escalation ${progressedBase.escalationType} progressed to stage ${nextStage.stageNumber}.`,
        correlationId: progressedBase.correlationId,
        reason: input.reason,
        payload: {
          orchestrationId: progressedBase.id,
          escalationType: progressedBase.escalationType,
          targetEntityType: progressedBase.targetEntityType,
          targetEntityId: progressedBase.targetEntityId,
          sourceSlaTimerId: progressedBase.sourceSlaTimerId,
          stageNumber: nextStage.stageNumber,
          stageName: nextStage.stageName,
          status: progressedBase.status,
        },
      });
      if (!recorded.ok) {
        return recorded;
      }

      nextStage.emittedEventIds.push(recorded.value.id);
      await repository.save(progressedBase);

      const scheduled = await scheduler.scheduleNextStage({
        orchestration: progressedBase,
        now: input.now,
        enqueueRuntimeJob: input.enqueueRuntimeJob,
      });
      if (!scheduled.ok) {
        return scheduled;
      }

      return serviceOk({
        orchestration: scheduled.value,
        stale: false,
        message: `Escalation progressed to stage ${nextStage.stageNumber}.`,
      });
    },
  };
}

function incrementNoop(
  orchestration: EscalationOrchestration,
  now: IsoDateTimeString,
): EscalationOrchestration {
  return {
    ...orchestration,
    noopCount: orchestration.noopCount + 1,
    updatedAt: now,
  };
}
