import "server-only";

import {
  ESCALATION_TYPES,
  WORK_ORDER_FIRST_RESPONSE_ESCALATION_POLICY,
  type EscalationPolicy,
  type EscalationType,
} from "@/modules/escalation/domain/escalation-policy";

export interface EscalationPolicyService {
  getPolicy(escalationType: EscalationType): EscalationPolicy | null;
}

export function createEscalationPolicyService(): EscalationPolicyService {
  return {
    getPolicy(escalationType) {
      if (escalationType === ESCALATION_TYPES.WorkOrderFirstResponseBreach) {
        return WORK_ORDER_FIRST_RESPONSE_ESCALATION_POLICY;
      }
      return null;
    },
  };
}
