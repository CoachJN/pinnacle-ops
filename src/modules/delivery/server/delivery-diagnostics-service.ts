import "server-only";

import type { DeliveryPlan } from "@/modules/delivery";
import type { FirestoreRepositories } from "@/server/repositories";
import { serviceOk, type ServiceResult } from "@/server/services";
import type { DeliveryPlanRepository } from "./delivery-plan-repository";

export interface DeliveryDiagnosticsService {
  getSummary(input: {
    organizationId: string;
    limit?: number;
  }): Promise<
    ServiceResult<{
      activeDeliveryPlans: readonly DeliveryPlan[];
      deliveryPlansByStatus: ReadonlyArray<{ status: DeliveryPlan["status"]; count: number }>;
      deliveryPlansByChannel: ReadonlyArray<{ channel: DeliveryPlan["channel"]; count: number }>;
      suppressedPlans: readonly DeliveryPlan[];
      cancelledPlans: readonly DeliveryPlan[];
      retryCounts: {
        totalRetryCount: number;
        maxRetryCount: number;
      };
      replayNoopCounts: {
        totalNoops: number;
      };
      recentDeliveryEvents: readonly unknown[];
      tenantSummary: {
        organizationId: string;
        totalPlans: number;
        activeCount: number;
        cancelledCount: number;
        suppressedCount: number;
        completedCount: number;
      };
    }>
  >;
}

export function createDeliveryDiagnosticsService(
  repositories: Pick<FirestoreRepositories, "domainEvents">,
  repository: DeliveryPlanRepository,
): DeliveryDiagnosticsService {
  return {
    async getSummary(input) {
      const [plans, events] = await Promise.all([
        repository.listByOrganizationId(input.organizationId, { limit: input.limit ?? 200 }),
        repositories.domainEvents.listByOrganizationId(input.organizationId, {
          limit: input.limit ?? 200,
        }),
      ]);

      const countMap = <TKey extends string>(items: readonly TKey[]) =>
        [...items.reduce<Map<TKey, number>>((accumulator, key) => {
          accumulator.set(key, (accumulator.get(key) ?? 0) + 1);
          return accumulator;
        }, new Map())].map(([key, count]) => ({ key, count }));

      const activeDeliveryPlans = plans.filter(
        (plan) => plan.status === "planned" || plan.status === "scheduled",
      );
      const cancelledPlans = plans.filter((plan) => plan.status === "cancelled");
      const suppressedPlans = plans.filter((plan) => plan.status === "suppressed");
      const completedPlans = plans.filter((plan) => plan.status === "completed");

      return serviceOk({
        activeDeliveryPlans,
        deliveryPlansByStatus: countMap(plans.map((plan) => plan.status)).map(({ key, count }) => ({
          status: key,
          count,
        })),
        deliveryPlansByChannel: countMap(plans.map((plan) => plan.channel)).map(({ key, count }) => ({
          channel: key,
          count,
        })),
        suppressedPlans,
        cancelledPlans,
        retryCounts: {
          totalRetryCount: plans.reduce((sum, plan) => sum + plan.retryCount, 0),
          maxRetryCount: plans.reduce((max, plan) => Math.max(max, plan.retryCount), 0),
        },
        replayNoopCounts: {
          totalNoops: plans.reduce((sum, plan) => sum + plan.noopCount, 0),
        },
        recentDeliveryEvents: events.items
          .filter((event) => event.type.startsWith("delivery_"))
          .slice(0, input.limit ?? 20),
        tenantSummary: {
          organizationId: input.organizationId,
          totalPlans: plans.length,
          activeCount: activeDeliveryPlans.length,
          cancelledCount: cancelledPlans.length,
          suppressedCount: suppressedPlans.length,
          completedCount: completedPlans.length,
        },
      });
    },
  };
}
