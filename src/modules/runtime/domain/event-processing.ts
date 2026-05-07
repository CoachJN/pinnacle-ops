import type { DomainEventType } from "@/server/events/types";
import type { EntityId, IsoDateTimeString } from "@/types/entity";

export const EVENT_PROCESSING_STATUSES = {
  Succeeded: "succeeded",
  Failed: "failed",
} as const;

export type EventProcessingStatus =
  (typeof EVENT_PROCESSING_STATUSES)[keyof typeof EVENT_PROCESSING_STATUSES];

export interface EventProcessingErrorState {
  code: string | null;
  message: string;
  retryable: boolean;
  occurredAt: IsoDateTimeString;
  details: Record<string, unknown>;
}

export interface EventProcessingJobRecord {
  jobId: EntityId;
  jobType: string;
  idempotencyKey: string;
}

export interface EventProcessingRecord {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  subscriberKey: string;
  subscriberName: string;
  sourceEventId: EntityId;
  eventType: DomainEventType;
  correlationId: string;
  causationId: string;
  idempotencyKey: string;
  status: EventProcessingStatus;
  attemptCount: number;
  jobCount: number;
  jobs: readonly EventProcessingJobRecord[];
  lastError: EventProcessingErrorState | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  completedAt: IsoDateTimeString | null;
}

export interface EventProcessingResult {
  processing: EventProcessingRecord;
  duplicate: boolean;
}

export interface EventSubscriberFailureDiagnostic {
  processingId: EntityId;
  subscriberKey: string;
  subscriberName: string;
  sourceEventId: EntityId;
  eventType: DomainEventType;
  attemptCount: number;
  lastError: EventProcessingErrorState | null;
  updatedAt: IsoDateTimeString;
}

export interface EventSubscriberCountsBySubscriber {
  subscriberKey: string;
  subscriberName: string;
  count: number;
  failedCount: number;
  lastProcessedAt: IsoDateTimeString | null;
}

export interface EventSubscriberDiagnostics {
  totalProcessed: number;
  successfulCount: number;
  failedCount: number;
  recordsBySubscriber: EventSubscriberCountsBySubscriber[];
  recentFailures: EventSubscriberFailureDiagnostic[];
  recentRecords: EventProcessingRecord[];
}
