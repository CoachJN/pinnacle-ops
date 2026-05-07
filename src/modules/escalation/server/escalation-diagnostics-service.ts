import "server-only";

import type { EscalationOrchestration } from "@/modules/escalation";
import type { FirestoreRepositories } from "@/server/repositories";
import { serviceOk, type ServiceResult } from "@/server/services";
import type { EscalationOrchestrationRepository } from "./escalation-orchestration-repository";

export interface EscalationDiagnosticsService {
  getSummary(input: {
    organizationId: string;
    now?: string;
    limit?: number;
  }): Promise<
    ServiceResult<{
      activeEscalations: readonly EscalationOrchestration[];
      escalationsByStage: ReadonlyArray<{ stageNumber: number; count: number }>;
      cancelledEscalations: readonly EscalationOrchestration[];
      suppressedEscalations: readonly EscalationOrchestration[];
      overdueEscalations: readonly EscalationOrchestration[];
      progressionLatency: ReadonlyArray<{ orchestrationId: string; stageNumber: number; latencyMs: number }>;
      replayNoopCounts: {
        totalProgressionAttempts: number;
        totalNoops: number;
      };
      recentEscalationEvents: readonly unknown[];
      tenantSummary: {
        organizationId: string;
        totalEscalations: number;
        activeCount: number;
        completedCount: number;
        cancelledCount: number;
        suppressedCount: number;
      };
    }>
  >;
}

export function createEscalationDiagnosticsService(
  repositories: Pick<FirestoreRepositories, "domainEvents">,
  repository: EscalationOrchestrationRepository,
): EscalationDiagnosticsService {
  return {
    async getSummary(input) {
      const [orchestrations, events] = await Promise.all([
        repository.listByOrganizationId(input.organizationId, {
          limit: input.limit ?? 200,
        }),
        repositories.domainEvents.listByOrganizationId(input.organizationId, {
          limit: input.limit ?? 200,
        }),
      ]);
      const now = input.now ?? new Date().toISOString();

      const activeEscalations = orchestrations.filter((item) => item.status === "active");
      const cancelledEscalations = orchestrations.filter((item) => item.status === "cancelled");
      const suppressedEscalations = orchestrations.filter((item) => item.status === "suppressed");
      const completedCount = orchestrations.filter((item) => item.status === "completed").length;
      const escalationsByStage = [...orchestrations.reduce<Map<number, number>>((accumulator, item) => {
        const stageNumber = item.currentStage?.stageNumber ?? 0;
        accumulator.set(stageNumber, (accumulator.get(stageNumber) ?? 0) + 1);
        return accumulator;
      }, new Map())]
        .map(([stageNumber, count]) => ({ stageNumber, count }))
        .sort((left, right) => left.stageNumber - right.stageNumber);

      return serviceOk({
        activeEscalations,
        escalationsByStage,
        cancelledEscalations,
        suppressedEscalations,
        overdueEscalations: activeEscalations
          .filter((item) => item.nextStageAt !== null && item.nextStageAt <= now)
          .sort((left, right) => (left.nextStageAt ?? "").localeCompare(right.nextStageAt ?? "")),
        progressionLatency: orchestrations.flatMap((item) => {
          const entries = item.stageHistory.slice(1);
          return entries.map((stage, index) => ({
            orchestrationId: item.id,
            stageNumber: stage.stageNumber,
            latencyMs:
              Date.parse(stage.enteredAt) - Date.parse(item.stageHistory[index]?.enteredAt ?? stage.enteredAt),
          }));
        }),
        replayNoopCounts: {
          totalProgressionAttempts: orchestrations.reduce(
            (sum, item) => sum + item.progressionAttemptCount,
            0,
          ),
          totalNoops: orchestrations.reduce((sum, item) => sum + item.noopCount, 0),
        },
        recentEscalationEvents: events.items
          .filter((item) => item.type.startsWith("escalation_"))
          .slice(0, input.limit ?? 20),
        tenantSummary: {
          organizationId: input.organizationId,
          totalEscalations: orchestrations.length,
          activeCount: activeEscalations.length,
          completedCount,
          cancelledCount: cancelledEscalations.length,
          suppressedCount: suppressedEscalations.length,
        },
      });
    },
  };
}
