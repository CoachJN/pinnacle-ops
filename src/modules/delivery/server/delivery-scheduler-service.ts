import "server-only";

import {
  type DeliveryPlan,
} from "@/modules/delivery";
import { serviceOk, type ServiceResult } from "@/server/services";
import type { IsoDateTimeString } from "@/types/entity";
import type { DeliveryPlanRepository } from "./delivery-plan-repository";

export interface DeliverySchedulerService {
  scheduleExecution(input: {
    plan: DeliveryPlan;
    now: IsoDateTimeString;
  }): Promise<ServiceResult<DeliveryPlan>>;
}

export function createDeliverySchedulerService(
  repository: DeliveryPlanRepository,
): DeliverySchedulerService {
  return {
    async scheduleExecution(input) {
      const scheduled: DeliveryPlan = {
        ...input.plan,
        status: "scheduled",
        activeRuntimeJobId: null,
        nextAttemptAt: input.now,
        updatedAt: input.now,
      };
      await repository.save(scheduled);
      return serviceOk(scheduled);
    },
  };
}
