import "server-only";

import { SLA_TIMER_STATUSES, type SlaTimer } from "@/modules/sla";
import type { SlaTimerRepository } from "./sla-timer-repository";
import { serviceOk, type ServiceResult } from "@/server/services/types";

export interface SlaDiagnosticsService {
  getSummary(input: {
    organizationId: string;
    now?: string;
    limit?: number;
  }): Promise<
    ServiceResult<{
      scheduledTimerCount: number;
      breachedTimerCount: number;
      satisfiedTimerCount: number;
      failedTimerCount: number;
      overdueScheduledTimers: ReadonlyArray<SlaTimer>;
      timersByType: ReadonlyArray<{ type: string; count: number }>;
      recentBreaches: ReadonlyArray<SlaTimer>;
      recentFailures: ReadonlyArray<SlaTimer>;
    }>
  >;
}

export function createSlaDiagnosticsService(
  repository: SlaTimerRepository,
): SlaDiagnosticsService {
  return {
    async getSummary(input) {
      const listed = await repository.listByOrganizationId(input.organizationId, {
        limit: input.limit ?? 200,
      });
      const now = input.now ?? new Date().toISOString();
      const items = listed.items;
      const timersByType = [...items.reduce<Map<string, number>>((accumulator, timer) => {
        accumulator.set(timer.type, (accumulator.get(timer.type) ?? 0) + 1);
        return accumulator;
      }, new Map())]
        .map(([type, count]) => ({ type, count }))
        .sort((left, right) => left.type.localeCompare(right.type));

      return serviceOk({
        scheduledTimerCount: items.filter((item) => item.status === SLA_TIMER_STATUSES.Scheduled).length,
        breachedTimerCount: items.filter((item) => item.status === SLA_TIMER_STATUSES.Breached).length,
        satisfiedTimerCount: items.filter((item) => item.status === SLA_TIMER_STATUSES.Satisfied).length,
        failedTimerCount: items.filter((item) => item.status === SLA_TIMER_STATUSES.Failed).length,
        overdueScheduledTimers: items
          .filter((item) => item.status === SLA_TIMER_STATUSES.Scheduled && item.dueAt <= now)
          .sort((left, right) => left.dueAt.localeCompare(right.dueAt)),
        timersByType,
        recentBreaches: items
          .filter((item) => item.status === SLA_TIMER_STATUSES.Breached)
          .sort((left, right) => (right.breachedAt ?? right.updatedAt).localeCompare(left.breachedAt ?? left.updatedAt))
          .slice(0, input.limit ?? 20),
        recentFailures: items
          .filter((item) => item.status === SLA_TIMER_STATUSES.Failed)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
          .slice(0, input.limit ?? 20),
      });
    },
  };
}
