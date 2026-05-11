import "server-only";

import type { EventSubscriberService } from "@/modules/runtime/server/event-subscriber-service";
import {
  type DurableOutboxRecord,
  type DurableOutboxService,
} from "./atomic-persistence-service";
import { serviceOk, type ServiceResult } from "./types";
import type { EntityId, IsoDateTimeString } from "@/types/entity";

export interface DurableOutboxReplayResult {
  scannedCount: number;
  processedCount: number;
  failedCount: number;
  pendingCount: number;
  records: readonly DurableOutboxRecord[];
}

export interface DurableOutboxReplayService {
  replayPending(input: {
    organizationId: EntityId;
    now: IsoDateTimeString;
    limit?: number;
  }): Promise<ServiceResult<DurableOutboxReplayResult>>;
}

export function createDurableOutboxReplayService(
  outbox: DurableOutboxService,
  subscribers: EventSubscriberService,
): DurableOutboxReplayService {
  return {
    async replayPending(input) {
      const records = await outbox.list({
        organizationId: input.organizationId,
        status: "pending",
        topic: "domain_event_dispatch",
        limit: input.limit ?? 100,
      });
      let processedCount = 0;
      let failedCount = 0;

      for (const record of records) {
        try {
          await subscribers.processEventById({
            organizationId: input.organizationId,
            eventId: record.sourceEventId,
            now: input.now,
          });
          await outbox.save({
            ...record,
            status: "processed",
            updatedAt: input.now,
            processedAt: input.now,
            lastError: null,
          });
          processedCount += 1;
        } catch (error) {
          failedCount += 1;
          await outbox.save({
            ...record,
            status: "failed",
            updatedAt: input.now,
            failureCount: record.failureCount + 1,
            lastError: {
              code:
                typeof error === "object" && error && "code" in error && typeof (error as { code?: unknown }).code === "string"
                  ? (error as { code: string }).code
                  : null,
              message:
                typeof error === "object" && error && "message" in error && typeof (error as { message?: unknown }).message === "string"
                  ? (error as { message: string }).message
                  : "Durable outbox replay failed.",
              occurredAt: input.now,
            },
          });
        }
      }

      const pending = await outbox.list({
        organizationId: input.organizationId,
        status: "pending",
        topic: "domain_event_dispatch",
        limit: input.limit ?? 100,
      });

      return serviceOk({
        scannedCount: records.length,
        processedCount,
        failedCount,
        pendingCount: pending.length,
        records,
      });
    },
  };
}
