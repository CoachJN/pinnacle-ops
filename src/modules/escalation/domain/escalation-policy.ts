import { ESCALATION_STAGE_NAMES, type EscalationStageName } from "./escalation-stage";

export const ESCALATION_TYPES = {
  WorkOrderFirstResponseBreach: "work_order.first_response_breach",
} as const;

export type EscalationType =
  (typeof ESCALATION_TYPES)[keyof typeof ESCALATION_TYPES];

export interface EscalationPolicyStageDefinition {
  stageNumber: number;
  stageName: EscalationStageName;
  delayMsFromPreviousStage: number;
}

export interface EscalationPolicy {
  escalationType: EscalationType;
  sourceTimerType: "work_order.first_response_due";
  version: string;
  stages: readonly EscalationPolicyStageDefinition[];
}

export const WORK_ORDER_FIRST_RESPONSE_ESCALATION_POLICY: EscalationPolicy = {
  escalationType: ESCALATION_TYPES.WorkOrderFirstResponseBreach,
  sourceTimerType: "work_order.first_response_due",
  version: "2026-05-06.v1",
  stages: [
    {
      stageNumber: 1,
      stageName: ESCALATION_STAGE_NAMES.Stage1,
      delayMsFromPreviousStage: 0,
    },
    {
      stageNumber: 2,
      stageName: ESCALATION_STAGE_NAMES.Stage2,
      delayMsFromPreviousStage: 60 * 60 * 1000,
    },
    {
      stageNumber: 3,
      stageName: ESCALATION_STAGE_NAMES.Stage3,
      delayMsFromPreviousStage: 4 * 60 * 60 * 1000,
    },
  ],
};
