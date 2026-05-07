import type { EntityId } from "@/types/entity";
import type { EscalationTargetEntityType } from "./escalation-orchestration";
import type { EscalationType } from "./escalation-policy";

export interface EscalationProgressJobPayload extends Record<string, unknown> {
  payloadVersion: "v1";
  action: "progress" | "cancel_if_resolved";
  escalationType: EscalationType;
  sourceSlaTimerId: EntityId;
  targetEntityType: EscalationTargetEntityType;
  targetEntityId: EntityId;
  sourceEventId: EntityId;
  requestedStageNumber?: number;
  reason: string;
}
