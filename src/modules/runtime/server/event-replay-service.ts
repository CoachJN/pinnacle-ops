import "server-only";

import type { EventProcessingResult } from "@/modules/runtime";
import { serviceFail, serviceOk, type ServiceResult } from "@/server/services";
import { notFoundError } from "@/server/services/errors";
import { nowIso } from "@/server/services/types";
import type { FirestoreRepositories } from "@/server/repositories";
import type { EventSubscriberService } from "./event-subscriber-service";

export interface EventReplayService {
  replay(input: {
    organizationId: string;
    eventId?: string | null;
    batchSize?: number;
    force?: boolean;
    now?: string;
  }): Promise<ServiceResult<readonly EventProcessingResult[]>>;
}

export function createEventReplayService(
  repositories: Pick<FirestoreRepositories, "domainEvents">,
  subscribers: EventSubscriberService,
): EventReplayService {
  return {
    async replay(input) {
      const timestamp = input.now ?? nowIso();
      if (input.eventId) {
        const directLookup = "getById" in repositories.domainEvents
          ? await repositories.domainEvents.getById(input.eventId)
          : null;
        if (directLookup && directLookup.organizationId === input.organizationId) {
          return subscribers.processEvent({
            event: directLookup,
            now: timestamp,
            force: input.force,
          });
        }

        return subscribers.processEventById({
          organizationId: input.organizationId,
          eventId: input.eventId,
          now: timestamp,
          force: input.force,
        });
      }

      const batchSize = Math.max(1, Math.min(input.batchSize ?? 25, 100));
      const events = await repositories.domainEvents.listByOrganizationId(input.organizationId, {
        limit: batchSize,
      });
      if (!events.items.length) {
        return serviceFail(notFoundError("No durable domain events were found for replay."));
      }

      const results: EventProcessingResult[] = [];
      for (const event of [...events.items].reverse()) {
        const processed = await subscribers.processEvent({
          event,
          now: timestamp,
          force: input.force,
        });
        if (!processed.ok) {
          return serviceFail(processed.error);
        }
        results.push(...processed.value);
      }

      return serviceOk(results);
    },
  };
}
