import "server-only";

import type { RuntimeCommandCenterSummary } from "../domain/runtime-summary";
import type { RuntimeAlertService } from "./runtime-alert-service";
import type { RuntimeHealthService } from "./runtime-health-service";
import type { RuntimeProjectionService } from "./runtime-projection-service";

export interface RuntimeCommandCenterService {
  getSummary(input: {
    organizationId: string;
    now: string;
  }): Promise<RuntimeCommandCenterSummary>;
}

export function createRuntimeCommandCenterService(
  projectionService: RuntimeProjectionService,
  healthService: RuntimeHealthService,
  alertService: RuntimeAlertService,
): RuntimeCommandCenterService {
  return {
    async getSummary(input) {
      const refreshed = await projectionService.refresh(input);
      const health = healthService.evaluate({
        projection: refreshed.projection,
        now: input.now,
      });
      const activeAlerts = await alertService.sync({
        projection: refreshed.projection,
        now: input.now,
      });
      return {
        projection: refreshed.projection,
        health,
        activeAlerts,
        tenantSummary: refreshed.projection.tenantSummary,
      };
    },
  };
}
