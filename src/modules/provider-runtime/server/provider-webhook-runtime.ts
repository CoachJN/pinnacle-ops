import "server-only";

import type { ProviderReceipt } from "@/modules/provider-runtime/domain/provider-receipt";
import type { ProviderWebhookEvent } from "@/modules/provider-runtime/domain/provider-webhook-event";
import type { ProviderReceiptRepository, ProviderWebhookEventRepository } from "@/modules/provider-runtime/server/provider-receipt-repository";
import type { ProviderReceiptNormalizer } from "@/modules/provider-runtime/server/provider-receipt-normalizer";
import type { DomainEventService } from "@/server/services";
import { serviceOk, type ServiceResult } from "@/server/services";
import type { EntityId, IsoDateTimeString } from "@/types/entity";
import { isAlreadyExistsError } from "@/lib/idempotency/already-exists";
import { buildStableEntityId } from "@/lib/idempotency/stable-entity-id";
import type { AtomicPersistenceService } from "@/server/services/atomic-persistence-service";

export interface ProviderWebhookRuntime {
  handleMicrosoftGraphWebhook(input: {
    organizationId: EntityId;
    payload: Record<string, unknown>;
    now: IsoDateTimeString;
  }): Promise<ServiceResult<{
    events: readonly ProviderWebhookEvent[];
    receipts: readonly ProviderReceipt[];
    duplicates: number;
  }>>;
}

export function createProviderWebhookRuntime(
  dependencies: {
    receipts: ProviderReceiptRepository;
    webhookEvents: ProviderWebhookEventRepository;
    normalizer: ProviderReceiptNormalizer;
    domainEvents: DomainEventService;
    atomicPersistence?: AtomicPersistenceService;
  },
): ProviderWebhookRuntime {
  return {
    async handleMicrosoftGraphWebhook(input) {
      const normalized = dependencies.normalizer.normalizeMicrosoftGraphWebhook(input.payload);
      const webhookEvents: ProviderWebhookEvent[] = [];
      const receipts: ProviderReceipt[] = [];
      let duplicates = 0;

      for (const candidate of normalized) {
        const webhookIdempotencyKey = dependencies.normalizer.buildWebhookIdempotencyKey({
          providerType: candidate.providerType,
          providerEventType: candidate.providerEventType,
          providerEventId: candidate.providerEventId,
          providerMessageId: candidate.providerMessageId,
          providerReceiptId: candidate.providerReceiptId,
          normalizedStatus: candidate.normalizedStatus,
        });

        const webhookEvent: ProviderWebhookEvent = {
          id: buildStableEntityId("provider-webhook", [
            input.organizationId,
            webhookIdempotencyKey,
          ]),
          organizationId: input.organizationId,
          tenantId: input.organizationId,
          providerType: candidate.providerType,
          providerEventType: candidate.providerEventType,
          providerEventId: candidate.providerEventId,
          providerMessageId: candidate.providerMessageId,
          providerCorrelationId: candidate.providerCorrelationId,
          providerReceiptId: candidate.providerReceiptId,
          normalizedStatus: candidate.normalizedStatus,
          idempotencyKey: webhookIdempotencyKey,
          correlationId: candidate.providerCorrelationId ?? `provider-webhook:${candidate.providerMessageId ?? candidate.providerReceiptId ?? "unknown"}`,
          causationId: candidate.providerEventId ?? webhookIdempotencyKey,
          status: "processed",
          receivedAt: input.now,
          processedAt: input.now,
          createdAt: input.now,
          updatedAt: input.now,
          payloadSummary: candidate.payloadSummary,
        };
        try {
          await dependencies.webhookEvents.create(webhookEvent);
          webhookEvents.push(webhookEvent);
        } catch (error) {
          if (!isAlreadyExistsError(error)) {
            throw error;
          }

          const existingWebhook = await dependencies.webhookEvents.getById(webhookEvent.id);
          if (!existingWebhook) {
            throw error;
          }
          duplicates += 1;
          webhookEvents.push(existingWebhook);
          continue;
        }

        await dependencies.domainEvents.record({
          organizationId: input.organizationId,
          actor: { userId: "system", role: "system" },
          requestId: webhookEvent.id,
          now: input.now,
          workOrderId: null,
          type: "provider_webhook_received",
          visibility: "internal",
          lifecycleStatus: null,
          entity: {
            entityType: "provider_webhook_event",
            entityId: webhookEvent.id,
            label: webhookEvent.providerType,
          },
          summary: `Provider webhook ${webhookEvent.id} received from ${webhookEvent.providerType}.`,
          correlationId: webhookEvent.correlationId,
          reason: webhookEvent.providerEventType,
          payload: {
            webhookEventId: webhookEvent.id,
            providerType: webhookEvent.providerType,
            providerEventType: webhookEvent.providerEventType,
            providerMessageId: webhookEvent.providerMessageId,
            providerReceiptId: webhookEvent.providerReceiptId,
            normalizedStatus: webhookEvent.normalizedStatus,
          } as never,
        });

        const receiptIdempotencyKey = [
          "provider.receipt",
          candidate.providerType,
          candidate.providerEventType,
          candidate.providerReceiptId ?? candidate.providerMessageId ?? webhookEvent.id,
          candidate.normalizedStatus,
        ].join(":");
        const receipt: ProviderReceipt = {
          id: buildStableEntityId("provider-receipt", [
            input.organizationId,
            receiptIdempotencyKey,
          ]),
          organizationId: input.organizationId,
          tenantId: input.organizationId,
          providerType: candidate.providerType,
          providerEventType: candidate.providerEventType,
          providerMessageId: candidate.providerMessageId,
          providerCorrelationId: candidate.providerCorrelationId,
          providerReceiptId: candidate.providerReceiptId,
          deliveryAttemptId: candidate.deliveryAttemptId,
          deliveryPlanId: candidate.deliveryPlanId,
          sourceWebhookEventId: webhookEvent.id,
          correlationId: webhookEvent.correlationId,
          causationId: webhookEvent.id,
          idempotencyKey: receiptIdempotencyKey,
          normalizedStatus: candidate.normalizedStatus,
          rawStatus: candidate.rawStatus,
          receivedAt: input.now,
          processedAt: null,
          reconciliationStatus: "pending",
          reconciliationReason: null,
          createdAt: input.now,
          updatedAt: input.now,
          metadata: candidate.payloadSummary,
        };
        try {
          await dependencies.receipts.create(receipt);
          receipts.push(receipt);
        } catch (error) {
          if (!isAlreadyExistsError(error)) {
            throw error;
          }

          const existingReceipt = await dependencies.receipts.getById(receipt.id);
          if (!existingReceipt) {
            throw error;
          }
          duplicates += 1;
          receipts.push(existingReceipt);
          continue;
        }

        await dependencies.domainEvents.record({
          organizationId: input.organizationId,
          actor: { userId: "system", role: "system" },
          requestId: receipt.id,
          now: input.now,
          workOrderId: null,
          type: "provider_receipt_recorded",
          visibility: "internal",
          lifecycleStatus: null,
          entity: {
            entityType: "provider_receipt",
            entityId: receipt.id,
            label: receipt.providerType,
          },
          summary: `Provider receipt ${receipt.id} recorded for reconciliation.`,
          correlationId: receipt.correlationId,
          reason: receipt.providerEventType,
          payload: {
            receiptId: receipt.id,
            deliveryAttemptId: receipt.deliveryAttemptId,
            deliveryPlanId: receipt.deliveryPlanId,
            providerType: receipt.providerType,
            normalizedStatus: receipt.normalizedStatus,
            sourceWebhookEventId: receipt.sourceWebhookEventId,
          } as never,
        });
      }

      return serviceOk({
        events: webhookEvents,
        receipts,
        duplicates,
      });
    },
  };
}
