import "server-only";

import type { RuntimeSchedulerDiagnostics } from "../domain/scheduler-result";
import type { SchedulerRepositories } from "./scheduler-task-repository";
import type { RuntimeSchedulerService } from "./runtime-scheduler-service";

export interface SchedulerDiagnosticsService {
  getDiagnostics(input: {
    organizationId: string;
    now: string;
  }): Promise<RuntimeSchedulerDiagnostics>;
}

export function createSchedulerDiagnosticsService(
  repositories: SchedulerRepositories,
  scheduler: RuntimeSchedulerService,
): SchedulerDiagnosticsService {
  return {
    async getDiagnostics(input) {
      await scheduler.ensureCanonicalTasks({
        organizationId: input.organizationId,
        now: input.now,
      });
      const [tasks, recentRuns, pendingConfirmations] = await Promise.all([
        repositories.tasks.listByOrganizationId({
          organizationId: input.organizationId,
          limit: 50,
        }),
        repositories.runs.listByOrganizationId({
          organizationId: input.organizationId,
          limit: 50,
        }),
        repositories.confirmations.listPendingByOrganizationId({
          organizationId: input.organizationId,
          limit: 50,
        }),
      ]);
      return {
        tasks,
        recentRuns,
        pendingConfirmations,
      };
    },
  };
}
