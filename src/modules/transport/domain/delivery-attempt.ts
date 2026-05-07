import type { DeliveryChannel, DeliveryType } from "@/modules/delivery";
import type { EntityId, IsoDateTimeString } from "@/types/entity";

export const DELIVERY_ATTEMPT_STATUSES = {
  Queued: "queued",
  Executing: "executing",
  Succeeded: "succeeded",
  Failed: "failed",
  RetryScheduled: "retry_scheduled",
  Cancelled: "cancelled",
  Suppressed: "suppressed",
} as const;

export type DeliveryAttemptStatus =
  (typeof DELIVERY_ATTEMPT_STATUSES)[keyof typeof DELIVERY_ATTEMPT_STATUSES];

export const TRANSPORT_ADAPTER_TYPES = {
  Internal: "internal",
  MicrosoftGraphEmail: "microsoft_graph_email",
} as const;

export type TransportAdapterType =
  (typeof TRANSPORT_ADAPTER_TYPES)[keyof typeof TRANSPORT_ADAPTER_TYPES];

export interface DeliveryAttempt {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  deliveryPlanId: EntityId;
  deliveryType: DeliveryType;
  channel: DeliveryChannel;
  adapterType: TransportAdapterType;
  sourceEventId: EntityId;
  correlationId: string;
  causationId: string;
  idempotencyKey: string;
  status: DeliveryAttemptStatus;
  providerMessageId: string | null;
  providerCorrelationId: string | null;
  providerReceiptId: string | null;
  retryCount: number;
  nextRetryAt: IsoDateTimeString | null;
  executionStartedAt: IsoDateTimeString | null;
  executionCompletedAt: IsoDateTimeString | null;
  failureCode: string | null;
  failureReason: string | null;
  emittedEventIds: readonly EntityId[];
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface TransportExecuteJobPayload extends Record<string, unknown> {
  payloadVersion: "v1";
  deliveryPlanId: EntityId;
  deliveryType: DeliveryType;
  attemptNumber: number;
  reason: string;
  triggerEventType:
    | "delivery_planned"
    | "delivery_scheduled"
    | "transport_attempt_retry_scheduled";
}
