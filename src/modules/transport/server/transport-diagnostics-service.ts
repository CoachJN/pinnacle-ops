import "server-only";

import type { DeliveryAttempt } from "@/modules/transport";
import type { FirestoreRepositories } from "@/server/repositories";
import { serviceOk, type ServiceResult } from "@/server/services";
import type { TransportAttemptRepository } from "./transport-attempt-repository";
import type { TransportAdapterRegistry } from "./transport-adapter-registry";

export interface TransportDiagnosticsService {
  getSummary(input: {
    organizationId: string;
    limit?: number;
  }): Promise<
    ServiceResult<{
      activeAttempts: readonly DeliveryAttempt[];
      attemptsByStatus: ReadonlyArray<{ status: DeliveryAttempt["status"]; count: number }>;
      attemptsByChannel: ReadonlyArray<{ channel: DeliveryAttempt["channel"]; count: number }>;
      retryCounts: {
        totalRetryCount: number;
        maxRetryCount: number;
      };
      recentFailures: readonly DeliveryAttempt[];
      receiptCorrelationSummaries: ReadonlyArray<{
        deliveryAttemptId: string;
        deliveryPlanId: string;
        providerMessageId: string | null;
        providerCorrelationId: string | null;
        providerReceiptId: string | null;
      }>;
      replayNoopCounts: {
        totalNoops: number;
      };
      adapterExecutionMetrics: ReadonlyArray<{
        adapterType: DeliveryAttempt["adapterType"];
        attemptCount: number;
        successCount: number;
        failureCount: number;
      }>;
      tenantSummary: {
        organizationId: string;
        totalAttempts: number;
        activeCount: number;
        succeededCount: number;
        failedCount: number;
        retryScheduledCount: number;
      };
      registeredAdapters: ReturnType<TransportAdapterRegistry["list"]>;
    }>
  >;
}

export function createTransportDiagnosticsService(
  repositories: Pick<FirestoreRepositories, "domainEvents">,
  repository: TransportAttemptRepository,
  registry: TransportAdapterRegistry,
): TransportDiagnosticsService {
  return {
    async getSummary(input) {
      const [attempts, events] = await Promise.all([
        repository.listByOrganizationId(input.organizationId, { limit: input.limit ?? 200 }),
        repositories.domainEvents.listByOrganizationId(input.organizationId, {
          limit: input.limit ?? 500,
        }),
      ]);

      const activeAttempts = attempts.filter(
        (attempt) => attempt.status === "queued" || attempt.status === "executing" || attempt.status === "retry_scheduled",
      );
      const recentFailures = attempts
        .filter((attempt) => attempt.status === "failed" || attempt.status === "retry_scheduled")
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, input.limit ?? 20);

      const countMap = <TKey extends string>(items: readonly TKey[]) =>
        [...items.reduce<Map<TKey, number>>((accumulator, key) => {
          accumulator.set(key, (accumulator.get(key) ?? 0) + 1);
          return accumulator;
        }, new Map())].map(([key, count]) => ({ key, count }));

      return serviceOk({
        activeAttempts,
        attemptsByStatus: countMap(attempts.map((attempt) => attempt.status)).map(({ key, count }) => ({
          status: key,
          count,
        })),
        attemptsByChannel: countMap(attempts.map((attempt) => attempt.channel)).map(({ key, count }) => ({
          channel: key,
          count,
        })),
        retryCounts: {
          totalRetryCount: attempts.reduce((sum, attempt) => sum + attempt.retryCount, 0),
          maxRetryCount: attempts.reduce((max, attempt) => Math.max(max, attempt.retryCount), 0),
        },
        recentFailures,
        receiptCorrelationSummaries: attempts
          .filter(
            (attempt) =>
              attempt.providerMessageId !== null ||
              attempt.providerCorrelationId !== null ||
              attempt.providerReceiptId !== null,
          )
          .slice(0, input.limit ?? 20)
          .map((attempt) => ({
            deliveryAttemptId: attempt.id,
            deliveryPlanId: attempt.deliveryPlanId,
            providerMessageId: attempt.providerMessageId,
            providerCorrelationId: attempt.providerCorrelationId,
            providerReceiptId: attempt.providerReceiptId,
          })),
        replayNoopCounts: {
          totalNoops: events.items.filter((event) => event.type === "transport_attempt_noop").length,
        },
        adapterExecutionMetrics: countMap(attempts.map((attempt) => attempt.adapterType)).map(({ key, count }) => ({
          adapterType: key,
          attemptCount: count,
          successCount: attempts.filter((attempt) => attempt.adapterType === key && attempt.status === "succeeded").length,
          failureCount: attempts.filter((attempt) => attempt.adapterType === key && attempt.status === "failed").length,
        })),
        tenantSummary: {
          organizationId: input.organizationId,
          totalAttempts: attempts.length,
          activeCount: activeAttempts.length,
          succeededCount: attempts.filter((attempt) => attempt.status === "succeeded").length,
          failedCount: attempts.filter((attempt) => attempt.status === "failed").length,
          retryScheduledCount: attempts.filter((attempt) => attempt.status === "retry_scheduled").length,
        },
        registeredAdapters: registry.list(),
      });
    },
  };
}
