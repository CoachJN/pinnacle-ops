import "server-only";

import type { RuntimeRepairAction } from "../domain/runtime-repair-action";
import type { RuntimeObservabilityRepositories } from "./runtime-observability-repository";

export interface RuntimeAuditService {
  listRepairHistory(input: {
    organizationId: string;
    limit?: number;
  }): Promise<readonly RuntimeRepairAction[]>;
}

export function createRuntimeAuditService(
  repositories: RuntimeObservabilityRepositories,
): RuntimeAuditService {
  return {
    listRepairHistory(input) {
      return repositories.repairActions.listByOrganizationId({
        organizationId: input.organizationId,
        limit: input.limit ?? 50,
      });
    },
  };
}
