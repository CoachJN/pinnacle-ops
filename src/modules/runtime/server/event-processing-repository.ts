import "server-only";

import type { EventProcessingRecord } from "@/modules/runtime";
import type { DomainEvent } from "@/server/events/types";
import type { FirestoreRepositories, RepositoryListResult } from "@/server/repositories";
import type { EntityId } from "@/types/entity";

export interface EventProcessingRepositoryAdapter {
  getDomainEventById(eventId: EntityId): Promise<DomainEvent | null>;
  findProcessingBySubscriberEvent(input: {
    organizationId: EntityId;
    subscriberKey: string;
    sourceEventId: EntityId;
  }): Promise<EventProcessingRecord | null>;
  saveProcessing(record: EventProcessingRecord): Promise<EventProcessingRecord>;
  listProcessingsByOrganizationId(
    organizationId: EntityId,
    options?: {
      limit?: number;
      subscriberKey?: string;
      sourceEventId?: EntityId;
      status?: EventProcessingRecord["status"];
    },
  ): Promise<RepositoryListResult<EventProcessingRecord>>;
}

export function createEventProcessingRepository(
  repositories: Pick<FirestoreRepositories, "domainEvents" | "runtimeEventProcessings">,
): EventProcessingRepositoryAdapter {
  return {
    async getDomainEventById(eventId) {
      return repositories.domainEvents.getById(eventId);
    },
    findProcessingBySubscriberEvent(input) {
      return repositories.runtimeEventProcessings.findBySubscriberEvent(input);
    },
    async saveProcessing(record) {
      await repositories.runtimeEventProcessings.save(record);
      return record;
    },
    listProcessingsByOrganizationId(organizationId, options) {
      return repositories.runtimeEventProcessings.listByOrganizationId(organizationId, options);
    },
  };
}
