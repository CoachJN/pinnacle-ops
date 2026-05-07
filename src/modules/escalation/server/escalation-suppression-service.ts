import "server-only";

import {
  ESCALATION_ORCHESTRATION_STATUSES,
  type EscalationOrchestration,
} from "@/modules/escalation";
import type { EscalationOrchestrationRepository } from "./escalation-orchestration-repository";

export interface EscalationSuppressionService {
  findOpenForCondition(input: {
    organizationId: string;
    escalationType: EscalationOrchestration["escalationType"];
    targetEntityType: EscalationOrchestration["targetEntityType"];
    targetEntityId: string;
  }): Promise<EscalationOrchestration | null>;
}

export function createEscalationSuppressionService(
  repository: EscalationOrchestrationRepository,
): EscalationSuppressionService {
  return {
    async findOpenForCondition(input) {
      const orchestration = await repository.findOpenByCondition(input);
      if (!orchestration) {
        return null;
      }
      if (
        orchestration.status === ESCALATION_ORCHESTRATION_STATUSES.Active ||
        orchestration.status === ESCALATION_ORCHESTRATION_STATUSES.Completed
      ) {
        return orchestration;
      }
      return null;
    },
  };
}
