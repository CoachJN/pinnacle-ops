import "server-only";

import {
  PROVIDER_RECEIPT_NORMALIZED_STATUSES,
  PROVIDER_RUNTIME_TYPES,
  type ProviderReceiptNormalizedStatus,
  type ProviderRuntimeType,
} from "@/modules/provider-runtime/domain/provider-receipt";
import type { ProviderWebhookEvent } from "@/modules/provider-runtime/domain/provider-webhook-event";

export interface MicrosoftGraphWebhookEnvelope {
  value?: readonly MicrosoftGraphWebhookNotification[] | null;
}

export interface MicrosoftGraphWebhookNotification {
  subscriptionId?: string | null;
  changeType?: string | null;
  clientState?: string | null;
  resource?: string | null;
  tenantId?: string | null;
  sequenceNumber?: number | null;
  lifecycleEvent?: string | null;
  resourceData?: {
    id?: string | null;
    internetMessageId?: string | null;
    correlationId?: string | null;
    status?: string | null;
    providerReceiptId?: string | null;
    deliveryAttemptId?: string | null;
    deliveryPlanId?: string | null;
  } | null;
}

export interface NormalizedProviderWebhookReceiptCandidate {
  providerType: ProviderRuntimeType;
  providerEventType: string;
  providerEventId: string | null;
  providerMessageId: string | null;
  providerCorrelationId: string | null;
  providerReceiptId: string | null;
  deliveryAttemptId: string | null;
  deliveryPlanId: string | null;
  normalizedStatus: ProviderReceiptNormalizedStatus;
  rawStatus: string | null;
  payloadSummary: Record<string, unknown>;
}

export interface ProviderReceiptNormalizer {
  normalizeMicrosoftGraphWebhook(
    payload: Record<string, unknown>,
  ): readonly NormalizedProviderWebhookReceiptCandidate[];
  buildWebhookIdempotencyKey(input: {
    providerType: ProviderRuntimeType;
    providerEventType: string;
    providerEventId: string | null;
    providerMessageId: string | null;
    providerReceiptId: string | null;
    normalizedStatus: ProviderReceiptNormalizedStatus;
  }): string;
}

export function createProviderReceiptNormalizer(): ProviderReceiptNormalizer {
  return {
    normalizeMicrosoftGraphWebhook(payload) {
      const envelope = payload as MicrosoftGraphWebhookEnvelope;
      const notifications = Array.isArray(envelope.value) ? envelope.value : [];
      return notifications.map((notification, index) => {
        const rawStatus =
          normalizeString(notification.resourceData?.status) ??
          normalizeString(notification.changeType) ??
          normalizeString(notification.lifecycleEvent);
        const normalizedStatus = normalizeMicrosoftGraphStatus(rawStatus);
        const providerEventType =
          normalizeString(notification.changeType) ??
          normalizeString(notification.lifecycleEvent) ??
          "message.updated";
        const providerEventId =
          [
            normalizeString(notification.subscriptionId),
            normalizeString(notification.resourceData?.id),
            typeof notification.sequenceNumber === "number"
              ? String(notification.sequenceNumber)
              : String(index),
          ]
            .filter(Boolean)
            .join(":") || null;

        return {
          providerType: PROVIDER_RUNTIME_TYPES.MicrosoftGraphEmail,
          providerEventType,
          providerEventId,
          providerMessageId: normalizeString(notification.resourceData?.id),
          providerCorrelationId: normalizeString(notification.resourceData?.correlationId),
          providerReceiptId:
            normalizeString(notification.resourceData?.providerReceiptId) ??
            normalizeString(notification.resourceData?.internetMessageId),
          deliveryAttemptId: normalizeString(notification.resourceData?.deliveryAttemptId),
          deliveryPlanId: normalizeString(notification.resourceData?.deliveryPlanId),
          normalizedStatus,
          rawStatus,
          payloadSummary: {
            subscriptionId: normalizeString(notification.subscriptionId),
            resource: normalizeString(notification.resource),
            tenantId: normalizeString(notification.tenantId),
            sequenceNumber: notification.sequenceNumber ?? null,
          },
        };
      });
    },

    buildWebhookIdempotencyKey(input) {
      return [
        "provider.webhook",
        input.providerType,
        input.providerEventType,
        input.providerEventId ?? "no-event-id",
        input.providerMessageId ?? "no-message-id",
        input.providerReceiptId ?? "no-provider-receipt-id",
        input.normalizedStatus,
      ].join(":");
    },
  };
}

function normalizeMicrosoftGraphStatus(value: string | null): ProviderReceiptNormalizedStatus {
  switch ((value ?? "").trim().toLowerCase()) {
    case "accepted":
    case "created":
    case "sent":
      return PROVIDER_RECEIPT_NORMALIZED_STATUSES.Accepted;
    case "queued":
      return PROVIDER_RECEIPT_NORMALIZED_STATUSES.Queued;
    case "delivered":
      return PROVIDER_RECEIPT_NORMALIZED_STATUSES.Delivered;
    case "failed":
    case "sendfailed":
      return PROVIDER_RECEIPT_NORMALIZED_STATUSES.Failed;
    case "bounced":
      return PROVIDER_RECEIPT_NORMALIZED_STATUSES.Bounced;
    case "rejected":
      return PROVIDER_RECEIPT_NORMALIZED_STATUSES.Rejected;
    default:
      return PROVIDER_RECEIPT_NORMALIZED_STATUSES.Unknown;
  }
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
