import "server-only";

import type { AccessActor } from "@/types/auth";
import type { EntityId } from "@/types/entity";
import type { TimelineEntry } from "@/server/events/types";
import type { FirestoreRepositories } from "@/server/repositories";
import { serviceOk, type ServiceResult } from "./types";
import type { DomainEventService } from "./domain-event-service";

export interface TimelineService {
  listForWorkOrder(
    workOrderId: EntityId,
    actor: AccessActor,
  ): Promise<ServiceResult<TimelineEntry[]>>;
}

export function createTimelineService(
  _repositories: Pick<FirestoreRepositories, "domainEvents">,
  dependencies: {
    domainEvents: DomainEventService;
  },
): TimelineService {
  return new DefaultTimelineService(dependencies.domainEvents);
}

class DefaultTimelineService implements TimelineService {
  constructor(private readonly domainEvents: DomainEventService) {}

  async listForWorkOrder(
    workOrderId: EntityId,
    actor: AccessActor,
  ): Promise<ServiceResult<TimelineEntry[]>> {
    const timeline = await this.domainEvents.listTimelineForWorkOrder(workOrderId, actor);
    if (!timeline.ok) {
      return timeline;
    }

    return serviceOk(timeline.value);
  }
}
