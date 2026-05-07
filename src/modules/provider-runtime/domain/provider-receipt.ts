import type { EntityId, IsoDateTimeString } from "@/types/entity";

export const PROVIDER_RUNTIME_TYPES = {
  MicrosoftGraphEmail: "microsoft_graph_email",
} as const;

export type ProviderRuntimeType =
  (typeof PROVIDER_RUNTIME_TYPES)[keyof typeof PROVIDER_RUNTIME_TYPES];

export const PROVIDER_RECEIPT_NORMALIZED_STATUSES = {
  Accepted: "accepted",
  Queued: "queued",
  Delivered: "delivered",
  Failed: "failed",
  Bounced: "bounced",
  Rejected: "rejected",
  Unknown: "unknown",
} as const;

export type ProviderReceiptNormalizedStatus =
  (typeof PROVIDER_RECEIPT_NORMALIZED_STATUSES)[keyof typeof PROVIDER_RECEIPT_NORMALIZED_STATUSES];

export const PROVIDER_RECEIPT_RECONCILIATION_STATUSES = {
  Pending: "pending",
  Processed: "processed",
  Duplicate: "duplicate",
  Ignored: "ignored",
  Failed: "failed",
} as const;

export type ProviderReceiptReconciliationStatus =
  (typeof PROVIDER_RECEIPT_RECONCILIATION_STATUSES)[keyof typeof PROVIDER_RECEIPT_RECONCILIATION_STATUSES];

export interface ProviderReceipt {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  providerType: ProviderRuntimeType;
  providerEventType: string;
  providerMessageId: string | null;
  providerCorrelationId: string | null;
  providerReceiptId: string | null;
  deliveryAttemptId: EntityId | null;
  deliveryPlanId: EntityId | null;
  sourceWebhookEventId: EntityId | null;
  correlationId: string;
  causationId: string;
  idempotencyKey: string;
  normalizedStatus: ProviderReceiptNormalizedStatus;
  rawStatus: string | null;
  receivedAt: IsoDateTimeString;
  processedAt: IsoDateTimeString | null;
  reconciliationStatus: ProviderReceiptReconciliationStatus;
  reconciliationReason: string | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  metadata: Record<string, unknown>;
}
