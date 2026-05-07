import "server-only";

import type {
  EventSubscriberDiagnostics,
  EventSubscriberFailureDiagnostic,
} from "@/modules/runtime";
import { EVENT_PROCESSING_STATUSES } from "@/modules/runtime";
import type { EventProcessingRepositoryAdapter } from "@/modules/runtime/server/event-processing-repository";
import type { EventSubscriberRegistry } from "@/modules/runtime/server/event-subscriber-registry";
import { serviceOk, type ServiceResult } from "@/server/services/types";

export interface SubscriberDiagnosticsService {
  getSummary(input: {
    organizationId: string;
    limit?: number;
  }): Promise<ServiceResult<EventSubscriberDiagnostics>>;
}

export function createSubscriberDiagnosticsService(
  repository: EventProcessingRepositoryAdapter,
  registry: EventSubscriberRegistry,
): SubscriberDiagnosticsService {
  return {
    async getSummary(input) {
      const records = await repository.listProcessingsByOrganizationId(input.organizationId, {
        limit: 500,
      });
      const failed = records.items.filter(
        (record) => record.status === EVENT_PROCESSING_STATUSES.Failed,
      );

      const counts = records.items.reduce<
        Map<string, { subscriberName: string; count: number; failedCount: number; lastProcessedAt: string | null }>
      >((accumulator, record) => {
        const existing = accumulator.get(record.subscriberKey) ?? {
          subscriberName: record.subscriberName,
          count: 0,
          failedCount: 0,
          lastProcessedAt: null,
        };
        existing.count += 1;
        if (record.status === EVENT_PROCESSING_STATUSES.Failed) {
          existing.failedCount += 1;
        }
        if (!existing.lastProcessedAt || existing.lastProcessedAt < record.updatedAt) {
          existing.lastProcessedAt = record.updatedAt;
        }
        accumulator.set(record.subscriberKey, existing);
        return accumulator;
      }, new Map());

      const registered = registry.list();
      const recordsBySubscriber = registered
        .map((subscriber): EventSubscriberDiagnostics["recordsBySubscriber"][number] => {
          const count = counts.get(subscriber.key);
          return {
            subscriberKey: subscriber.key,
            subscriberName: subscriber.name,
            count: count?.count ?? 0,
            failedCount: count?.failedCount ?? 0,
            lastProcessedAt: count?.lastProcessedAt ?? null,
          };
        })
        .sort((left, right) => left.subscriberKey.localeCompare(right.subscriberKey));

      const recentFailures: EventSubscriberFailureDiagnostic[] = failed
        .map((record) => ({
          processingId: record.id,
          subscriberKey: record.subscriberKey,
          subscriberName: record.subscriberName,
          sourceEventId: record.sourceEventId,
          eventType: record.eventType,
          attemptCount: record.attemptCount,
          lastError: record.lastError,
          updatedAt: record.updatedAt,
        }))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, input.limit ?? 20);

      return serviceOk({
        totalProcessed: records.items.length,
        successfulCount: records.items.length - failed.length,
        failedCount: failed.length,
        recordsBySubscriber,
        recentFailures,
        recentRecords: records.items.slice(0, input.limit ?? 20),
      });
    },
  };
}
