import "server-only";

import type { FirestoreRepositories } from "@/server/repositories";
import type { RuntimeDeadLetterOperationsSummary } from "../domain/runtime-summary";
import type { RuntimeProjectionSources } from "./runtime-projection-service";

export interface DeadLetterOperationsService {
  summarize(input: {
    organizationId: string;
    sources?: RuntimeProjectionSources;
  }): Promise<RuntimeDeadLetterOperationsSummary>;
}

export function createDeadLetterOperationsService(
  repositories: Pick<FirestoreRepositories, "runtimeJobs" | "runtimeDeadLetters">,
): DeadLetterOperationsService {
  return {
    async summarize(input) {
      const [deadLetters, jobs] = await Promise.all([
        input.sources
          ? Promise.resolve(input.sources.deadLetters)
          : repositories.runtimeDeadLetters
              .listByOrganizationId(input.organizationId, { limit: 200 })
              .then((result) => result.items),
        input.sources
          ? Promise.resolve(input.sources.jobs)
          : repositories.runtimeJobs
              .listByOrganizationId(input.organizationId, { limit: 500 })
              .then((result) => result.items),
      ]);
      const jobIds = new Set(jobs.map((item) => item.id));
      return {
        totalDeadLetters: deadLetters.length,
        recentDeadLetters: deadLetters
          .slice()
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .slice(0, 50),
        missingOriginalJobCount: deadLetters.filter(
          (item) => !jobIds.has(item.originalJobId),
        ).length,
      };
    },
  };
}
