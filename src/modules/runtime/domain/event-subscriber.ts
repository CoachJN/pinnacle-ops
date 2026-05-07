import type { DomainEvent, DomainEventType } from "@/server/events/types";
import type { EntityId, IsoDateTimeString } from "@/types/entity";

export interface EventSubscriberJobRequest<
  TPayload extends Record<string, unknown> = Record<string, unknown>,
> {
  type: string;
  payload: TPayload;
  payloadVersion: string;
  idempotencyKey: string;
  maxAttempts?: number;
  runAfter?: IsoDateTimeString | null;
}

export interface EventSubscriberContext<TType extends DomainEventType = DomainEventType> {
  event: DomainEvent<TType>;
  organizationId: EntityId;
  sourceEventId: EntityId;
  correlationId: string;
  causationId: string;
  now: IsoDateTimeString;
}

export interface EventSubscriberDefinition<TType extends DomainEventType = DomainEventType> {
  key: string;
  name: string;
  description: string;
  eventTypes: readonly TType[];
  jobType: string;
  buildJobs: (
    context: EventSubscriberContext<TType>,
  ) => readonly EventSubscriberJobRequest[] | Promise<readonly EventSubscriberJobRequest[]>;
}

export interface RegisteredEventSubscriber {
  key: string;
  name: string;
  description: string;
  eventTypes: readonly DomainEventType[];
  jobType: string;
}
