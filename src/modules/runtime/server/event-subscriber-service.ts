import "server-only";

import type {
  EventProcessingRecord,
  EventProcessingResult,
  EventSubscriberDefinition,
  RegisteredEventSubscriber,
} from "@/modules/runtime";
import { EVENT_PROCESSING_STATUSES } from "@/modules/runtime";
import type { EventProcessingRepositoryAdapter } from "@/modules/runtime/server/event-processing-repository";
import type { EventSubscriberRegistry } from "@/modules/runtime/server/event-subscriber-registry";
import type { EventToJobService } from "@/modules/runtime/server/event-to-job-service";
import { validationError } from "@/server/services/errors";
import { nowIso, serviceFail, serviceOk, type ServiceResult } from "@/server/services/types";
import type { DomainEvent } from "@/server/events/types";
import type { EntityId, IsoDateTimeString } from "@/types/entity";

export interface EventSubscriberService {
  listRegistered(): readonly RegisteredEventSubscriber[];
  processEvent(input: {
    event: DomainEvent;
    now?: IsoDateTimeString;
    force?: boolean;
  }): Promise<ServiceResult<readonly EventProcessingResult[]>>;
  processEventById(input: {
    organizationId: EntityId;
    eventId: EntityId;
    now?: IsoDateTimeString;
    force?: boolean;
  }): Promise<ServiceResult<readonly EventProcessingResult[]>>;
  listProcessingRecords(input: {
    organizationId: EntityId;
    limit?: number;
    subscriberKey?: string;
    sourceEventId?: EntityId;
    status?: EventProcessingRecord["status"];
  }): Promise<ServiceResult<readonly EventProcessingRecord[]>>;
}

export function createEventSubscriberService(
  registry: EventSubscriberRegistry,
  repository: EventProcessingRepositoryAdapter,
  eventToJob: EventToJobService,
): EventSubscriberService {
  return {
    listRegistered() {
      return registry.list();
    },

    async processEvent(input) {
      const timestamp = input.now ?? nowIso();
      const subscribers = registry.getSubscribersForEventType(input.event.type);
      const processed: EventProcessingResult[] = [];

      for (const subscriber of subscribers) {
        processed.push(await processForSubscriber({
          event: input.event,
          subscriber,
          repository,
          eventToJob,
          now: timestamp,
          force: input.force ?? false,
        }));
      }

      return serviceOk(processed);
    },

    async processEventById(input) {
      const event = await repository.getDomainEventById(input.eventId);
      if (!event || event.organizationId !== input.organizationId) {
        return serviceFail(validationError("Domain event not found for subscriber processing."));
      }

      return this.processEvent({
        event,
        now: input.now,
        force: input.force,
      });
    },

    async listProcessingRecords(input) {
      const result = await repository.listProcessingsByOrganizationId(input.organizationId, {
        limit: input.limit,
        subscriberKey: input.subscriberKey,
        sourceEventId: input.sourceEventId,
        status: input.status,
      });
      return serviceOk(result.items);
    },
  };
}

async function processForSubscriber(input: {
  event: DomainEvent;
  subscriber: EventSubscriberDefinition;
  repository: EventProcessingRepositoryAdapter;
  eventToJob: EventToJobService;
  now: IsoDateTimeString;
  force: boolean;
}): Promise<EventProcessingResult> {
  const existing = await input.repository.findProcessingBySubscriberEvent({
    organizationId: input.event.organizationId,
    subscriberKey: input.subscriber.key,
    sourceEventId: input.event.id,
  });

  if (
    existing &&
    existing.status === EVENT_PROCESSING_STATUSES.Succeeded &&
    !input.force
  ) {
    return {
      processing: existing,
      duplicate: true,
    };
  }

  const correlationId = normalizeCorrelationId(input.event);
  const causationId = input.event.id;
  const attemptCount = (existing?.attemptCount ?? 0) + 1;
  const recordBase = {
    id: buildProcessingId(input.subscriber.key, input.event.id),
    organizationId: input.event.organizationId,
    tenantId: input.event.organizationId,
    subscriberKey: input.subscriber.key,
    subscriberName: input.subscriber.name,
    sourceEventId: input.event.id,
    eventType: input.event.type,
    correlationId,
    causationId,
    idempotencyKey: buildProcessingIdempotencyKey(input.subscriber.key, input.event.id),
    attemptCount,
    createdAt: existing?.createdAt ?? input.now,
    updatedAt: input.now,
  } as const;

  try {
    const jobs = await input.subscriber.buildJobs({
      event: input.event,
      organizationId: input.event.organizationId,
      sourceEventId: input.event.id,
      correlationId,
      causationId,
      now: input.now,
    });

    const queued = await input.eventToJob.enqueueJobs({
      event: input.event,
      subscriber: input.subscriber,
      jobs,
      correlationId,
      causationId,
      now: input.now,
    });
    if (!queued.ok) {
      throw queued.error;
    }

    const record: EventProcessingRecord = {
      ...recordBase,
      status: EVENT_PROCESSING_STATUSES.Succeeded,
      jobCount: queued.value.length,
      jobs: queued.value,
      lastError: null,
      completedAt: input.now,
    };
    await input.repository.saveProcessing(record);

    return {
      processing: record,
      duplicate: false,
    };
  } catch (error) {
    const failed: EventProcessingRecord = {
      ...recordBase,
      status: EVENT_PROCESSING_STATUSES.Failed,
      jobCount: existing?.jobCount ?? 0,
      jobs: existing?.jobs ?? [],
      lastError: sanitizeProcessingError(error, input.now),
      completedAt: null,
    };
    await input.repository.saveProcessing(failed);

    return {
      processing: failed,
      duplicate: false,
    };
  }
}

function buildProcessingId(subscriberKey: string, sourceEventId: EntityId): EntityId {
  return `event-processing:${subscriberKey}:${sourceEventId}`;
}

function buildProcessingIdempotencyKey(subscriberKey: string, sourceEventId: EntityId): string {
  return `event-subscriber:${subscriberKey}:${sourceEventId}`;
}

function normalizeCorrelationId(event: DomainEvent): string {
  const correlationId = event.metadata.correlationId?.trim();
  return correlationId && correlationId.length > 0 ? correlationId : `event:${event.id}`;
}

function sanitizeProcessingError(
  error: unknown,
  occurredAt: IsoDateTimeString,
): EventProcessingRecord["lastError"] {
  if (typeof error === "object" && error !== null) {
    const value = error as { code?: unknown; message?: unknown; safeMessage?: unknown };
    return {
      code: typeof value.code === "string" ? value.code : null,
      message:
        typeof value.safeMessage === "string"
          ? value.safeMessage
          : typeof value.message === "string"
            ? value.message
            : "Subscriber processing failed.",
      retryable: true,
      occurredAt,
      details: {},
    };
  }

  return {
    code: null,
    message: "Subscriber processing failed.",
    retryable: true,
    occurredAt,
    details: {},
  };
}
