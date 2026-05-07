import "server-only";

import type {
  EscalationOrchestration,
  EscalationPolicy,
  EscalationPolicyService,
} from "@/modules/escalation";
import { serviceOk, type ServiceResult } from "@/server/services";
import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { EscalationOrchestrationRepository } from "./escalation-orchestration-repository";

export interface EscalationSchedulerService {
  getNextStage(input: {
    orchestration: EscalationOrchestration;
  }): {
    stageNumber: number;
    stageName: string;
    scheduledFor: IsoDateTimeString;
  } | null;
  scheduleNextStage(input: {
    orchestration: EscalationOrchestration;
    now: IsoDateTimeString;
    enqueueRuntimeJob: (job: {
      type: "escalation.progress";
      payloadVersion: "v1";
      payload: Record<string, unknown>;
      idempotencyKey: string;
      runAfter: IsoDateTimeString;
      correlationId: string;
      causationId: string;
      sourceEventId: EntityId;
    }) => Promise<ServiceResult<{ id: EntityId }>>;
  }): Promise<ServiceResult<EscalationOrchestration>>;
}

export function createEscalationSchedulerService(
  repository: EscalationOrchestrationRepository,
  policyService: EscalationPolicyService,
): EscalationSchedulerService {
  return {
    getNextStage(input) {
      const policy = policyService.getPolicy(input.orchestration.escalationType);
      if (!policy) {
        return null;
      }
      return computeNextStage(input.orchestration, policy);
    },

    async scheduleNextStage(input) {
      const nextStage = this.getNextStage({ orchestration: input.orchestration });
      if (!nextStage) {
        const completed = {
          ...input.orchestration,
          activeRuntimeJobId: null,
          nextStageAt: null,
          resolvedAt: input.orchestration.resolvedAt ?? input.now,
          updatedAt: input.now,
        };
        await repository.save(completed);
        return serviceOk(completed);
      }

      const queued = await input.enqueueRuntimeJob({
        type: "escalation.progress",
        payloadVersion: "v1",
        payload: {
          payloadVersion: "v1",
          action: "progress",
          escalationType: input.orchestration.escalationType,
          sourceSlaTimerId: input.orchestration.sourceSlaTimerId,
          targetEntityType: input.orchestration.targetEntityType,
          targetEntityId: input.orchestration.targetEntityId,
          sourceEventId: input.orchestration.sourceEventId,
          requestedStageNumber: nextStage.stageNumber,
          reason: `scheduled_${nextStage.stageName}`,
        },
        idempotencyKey: [
          "escalation.progress",
          input.orchestration.id,
          "stage",
          String(nextStage.stageNumber),
        ].join(":"),
        runAfter: nextStage.scheduledFor,
        correlationId: input.orchestration.correlationId,
        causationId: input.orchestration.causationId,
        sourceEventId: input.orchestration.sourceEventId,
      });
      if (!queued.ok) {
        return queued;
      }

      const stageHistory = [...input.orchestration.stageHistory];
      const current = stageHistory[stageHistory.length - 1] ?? null;
      if (current && !current.scheduledRuntimeJobIds.includes(queued.value.id)) {
        current.scheduledRuntimeJobIds = [...current.scheduledRuntimeJobIds, queued.value.id];
      }

      const updated = {
        ...input.orchestration,
        stageHistory,
        activeRuntimeJobId: queued.value.id,
        nextStageAt: nextStage.scheduledFor,
        updatedAt: input.now,
      };
      await repository.save(updated);
      return serviceOk(updated);
    },
  };
}

function computeNextStage(
  orchestration: EscalationOrchestration,
  policy: EscalationPolicy,
): {
  stageNumber: number;
  stageName: string;
  scheduledFor: IsoDateTimeString;
} | null {
  const currentStageNumber = orchestration.currentStage?.stageNumber ?? 0;
  const nextStage = policy.stages.find((stage) => stage.stageNumber === currentStageNumber + 1);
  if (!nextStage) {
    return null;
  }

  const anchor = orchestration.currentStage
    ? orchestration.stageHistory.find(
        (item) => item.stageNumber === orchestration.currentStage?.stageNumber,
      )?.enteredAt ?? orchestration.updatedAt
    : orchestration.createdAt;

  return {
    stageNumber: nextStage.stageNumber,
    stageName: nextStage.stageName,
    scheduledFor: new Date(Date.parse(anchor) + nextStage.delayMsFromPreviousStage).toISOString(),
  };
}
