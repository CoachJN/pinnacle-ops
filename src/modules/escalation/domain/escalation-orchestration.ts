import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { EscalationType } from "./escalation-policy";
import type { EscalationStage, EscalationStageName } from "./escalation-stage";

export const ESCALATION_TARGET_ENTITY_TYPES = {
  WorkOrder: "work_order",
} as const;

export type EscalationTargetEntityType =
  (typeof ESCALATION_TARGET_ENTITY_TYPES)[keyof typeof ESCALATION_TARGET_ENTITY_TYPES];

export const ESCALATION_ORCHESTRATION_STATUSES = {
  Active: "active",
  Suppressed: "suppressed",
  Cancelled: "cancelled",
  Completed: "completed",
  Failed: "failed",
} as const;

export type EscalationOrchestrationStatus =
  (typeof ESCALATION_ORCHESTRATION_STATUSES)[keyof typeof ESCALATION_ORCHESTRATION_STATUSES];

export interface EscalationCurrentStage {
  stageNumber: number;
  stageName: EscalationStageName;
}

export interface EscalationOrchestration {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  escalationType: EscalationType;
  targetEntityType: EscalationTargetEntityType;
  targetEntityId: EntityId;
  sourceSlaTimerId: EntityId;
  sourceEventId: EntityId;
  correlationId: string;
  causationId: string;
  idempotencyKey: string;
  status: EscalationOrchestrationStatus;
  currentStage: EscalationCurrentStage | null;
  stageHistory: EscalationStage[];
  activeRuntimeJobId: EntityId | null;
  nextStageAt: IsoDateTimeString | null;
  suppressedReason: string | null;
  cancellationReason: string | null;
  resolvedAt: IsoDateTimeString | null;
  lastProgressedAt: IsoDateTimeString | null;
  progressionAttemptCount: number;
  noopCount: number;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}
