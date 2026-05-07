import type { EntityId, IsoDateTimeString } from "@/types/entity";

export const ESCALATION_STAGE_NAMES = {
  Stage1: "stage_1_initial",
  Stage2: "stage_2_follow_up",
  Stage3: "stage_3_terminal",
} as const;

export type EscalationStageName =
  (typeof ESCALATION_STAGE_NAMES)[keyof typeof ESCALATION_STAGE_NAMES];

export interface EscalationStage {
  stageNumber: number;
  stageName: EscalationStageName;
  enteredAt: IsoDateTimeString;
  completedAt: IsoDateTimeString | null;
  progressionReason: string;
  emittedEventIds: EntityId[];
  scheduledRuntimeJobIds: EntityId[];
}
