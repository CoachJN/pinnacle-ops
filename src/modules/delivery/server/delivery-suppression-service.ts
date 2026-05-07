import "server-only";

import { DELIVERY_PLAN_STATUSES, type DeliveryPlan } from "@/modules/delivery";
import type { IsoDateTimeString } from "@/types/entity";
import type { DeliveryPlanRepository } from "./delivery-plan-repository";

export interface DeliverySuppressionService {
  findActiveForRecipient(input: {
    organizationId: string;
    deliveryType: DeliveryPlan["deliveryType"];
    sourceEscalationId: string;
    sourceEscalationStageNumber: number | null;
    recipientId: string;
    channel: DeliveryPlan["channel"];
  }): Promise<DeliveryPlan | null>;
  cancelForEscalation(input: {
    organizationId: string;
    sourceEscalationId: string;
    now: IsoDateTimeString;
    reason: string;
  }): Promise<readonly DeliveryPlan[]>;
}

export function createDeliverySuppressionService(
  repository: DeliveryPlanRepository,
): DeliverySuppressionService {
  return {
    findActiveForRecipient(input) {
      return repository.findActiveForRecipient(input);
    },
    async cancelForEscalation(input) {
      const plans = await repository.listByEscalation({
        organizationId: input.organizationId,
        sourceEscalationId: input.sourceEscalationId,
        limit: 200,
      });
      const cancelled: DeliveryPlan[] = [];
      for (const plan of plans) {
        if (
          plan.status === DELIVERY_PLAN_STATUSES.Cancelled ||
          plan.status === DELIVERY_PLAN_STATUSES.Completed ||
          plan.status === DELIVERY_PLAN_STATUSES.Suppressed
        ) {
          continue;
        }
        const next: DeliveryPlan = {
          ...plan,
          status: DELIVERY_PLAN_STATUSES.Cancelled,
          activeRuntimeJobId: null,
          nextAttemptAt: null,
          cancellationReason: input.reason,
          updatedAt: input.now,
        };
        await repository.save(next);
        cancelled.push(next);
      }
      return cancelled;
    },
  };
}
