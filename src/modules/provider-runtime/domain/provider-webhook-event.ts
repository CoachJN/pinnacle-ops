import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { ProviderRuntimeType } from "./provider-receipt";

export const PROVIDER_WEBHOOK_EVENT_STATUSES = {
  Pending: "pending",
  Processed: "processed",
  Duplicate: "duplicate",
  Ignored: "ignored",
  Failed: "failed",
} as const;

export type ProviderWebhookEventStatus =
  (typeof PROVIDER_WEBHOOK_EVENT_STATUSES)[keyof typeof PROVIDER_WEBHOOK_EVENT_STATUSES];

export interface ProviderWebhookEvent {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  providerType: ProviderRuntimeType;
  providerEventType: string;
  providerEventId: string | null;
  providerMessageId: string | null;
  providerCorrelationId: string | null;
  providerReceiptId: string | null;
  normalizedStatus: string | null;
  idempotencyKey: string;
  correlationId: string;
  causationId: string;
  status: ProviderWebhookEventStatus;
  receivedAt: IsoDateTimeString;
  processedAt: IsoDateTimeString | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  payloadSummary: Record<string, unknown>;
}
