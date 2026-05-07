import "server-only";

import type { FirestoreRepositories } from "@/server/repositories";
import type { ProviderRuntimeDomainServices } from "@/server/services";
import type { RuntimeReplayOperationsSummary } from "../domain/runtime-summary";
import type { RuntimeProjectionSources } from "./runtime-projection-service";

export interface ReplayOperationsService {
  summarize(input: {
    organizationId: string;
    sources?: RuntimeProjectionSources;
  }): Promise<RuntimeReplayOperationsSummary>;
}

export function createReplayOperationsService(
  repositories: Pick<FirestoreRepositories, "runtimeEventProcessings">,
  providerRuntime: Pick<ProviderRuntimeDomainServices, "storage">,
): ReplayOperationsService {
  return {
    async summarize(input) {
      const [eventProcessings, providerReceipts] = await Promise.all([
        input.sources
          ? Promise.resolve(input.sources.eventProcessings)
          : repositories.runtimeEventProcessings
              .listByOrganizationId(input.organizationId, { limit: 100 })
              .then((result) => result.items),
        input.sources
          ? Promise.resolve(input.sources.providerReceipts)
          : providerRuntime.storage.receipts.listByOrganizationId({
              organizationId: input.organizationId,
              limit: 100,
            }),
      ]);
      return {
        recentEventProcessings: eventProcessings
          .slice()
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
          .slice(0, 50),
        recentProviderReceipts: providerReceipts
          .slice()
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
          .slice(0, 50),
        replayBacklogCount: eventProcessings.filter((item) => item.status === "failed").length,
        reconciliationFailureCount: providerReceipts.filter(
          (item) => item.reconciliationStatus === "failed",
        ).length,
      };
    },
  };
}
