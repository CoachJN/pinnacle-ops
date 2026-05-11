import "server-only";

import type { DeliveryPlan } from "@/modules/delivery";
import type { ProviderReceipt } from "@/modules/provider-runtime/domain/provider-receipt";
import type { ProviderReceiptRepository } from "@/modules/provider-runtime/server/provider-receipt-repository";
import { createProviderReceiptNormalizer, type ProviderReceiptNormalizer } from "./provider-receipt-normalizer";
import { createProviderWebhookRuntime, type ProviderWebhookRuntime } from "./provider-webhook-runtime";
import { createProviderReconciliationService, type ProviderReconciliationService } from "./provider-reconciliation-service";
import { createProviderHealthService, type ProviderHealthService } from "./provider-health-service";
import { createProviderReceiptDiagnosticsService, type ProviderReceiptDiagnosticsService } from "./provider-receipt-diagnostics-service";
import type { TransportAttemptRepository } from "@/modules/transport";
import type { DomainEventService } from "@/server/services";
import type { AtomicPersistenceService } from "@/server/services/atomic-persistence-service";
import { createFirestoreProviderRuntimeStorage, type ProviderRuntimeStorage } from "./provider-runtime-storage";
import { createProviderWebhookSecurityService, type ProviderWebhookSecurityService } from "./provider-webhook-security";
import type { ProviderConnectionRepository } from "@/server/repositories";
import { isAlreadyExistsError } from "@/lib/idempotency/already-exists";
import { buildStableEntityId } from "@/lib/idempotency/stable-entity-id";

export interface ProviderReceiptCaptureService {
  recordAdapterReceipt(input: {
    organizationId: string;
    providerType: string;
    providerEventType: string;
    providerMessageId: string | null;
    providerCorrelationId: string | null;
    providerReceiptId: string | null;
    deliveryAttemptId: string;
    deliveryPlanId: string;
    correlationId: string;
    causationId: string;
    normalizedStatus: "accepted" | "queued";
    rawStatus: string | null;
    now: string;
    metadata?: Record<string, unknown>;
  }): Promise<void>;
}

export interface ProviderRuntimeDomainServices {
  capture: ProviderReceiptCaptureService;
  normalizer: ProviderReceiptNormalizer;
  webhooks: ProviderWebhookRuntime;
  webhookSecurity: ProviderWebhookSecurityService;
  reconciliation: ProviderReconciliationService;
  health: ProviderHealthService;
  diagnostics: ProviderReceiptDiagnosticsService;
  storage: ProviderRuntimeStorage;
}

export function createProviderRuntimeServices(
  dependencies: {
    domainEvents: DomainEventService;
    attempts: TransportAttemptRepository;
    providerConnections: ProviderConnectionRepository;
    getDeliveryPlanById: (id: string) => Promise<DeliveryPlan | null>;
    saveDeliveryPlan: (plan: DeliveryPlan) => Promise<void>;
    storage?: ProviderRuntimeStorage;
    atomicPersistence?: AtomicPersistenceService;
  },
): ProviderRuntimeDomainServices {
  const storage = dependencies.storage ?? createFirestoreProviderRuntimeStorage();
  const normalizer = createProviderReceiptNormalizer();
  const capture = createProviderReceiptCaptureService(storage.receipts, dependencies.domainEvents);
  const webhookSecurity = createProviderWebhookSecurityService({
    providerConnections: dependencies.providerConnections,
  });
  const webhooks = createProviderWebhookRuntime({
    receipts: storage.receipts,
    webhookEvents: storage.webhookEvents,
    normalizer,
    domainEvents: dependencies.domainEvents,
    atomicPersistence: dependencies.atomicPersistence,
  });
  const reconciliation = createProviderReconciliationService({
    receipts: storage.receipts,
    attempts: dependencies.attempts,
    getDeliveryPlanById: dependencies.getDeliveryPlanById,
    saveDeliveryPlan: dependencies.saveDeliveryPlan,
    domainEvents: dependencies.domainEvents,
  });
  const health = createProviderHealthService(storage.receipts, storage.webhookEvents);
  const diagnostics = createProviderReceiptDiagnosticsService(storage.receipts, storage.webhookEvents, health);

  return {
    capture,
    normalizer,
    webhooks,
    webhookSecurity,
    reconciliation,
    health,
    diagnostics,
    storage,
  };
}

function createProviderReceiptCaptureService(
  receipts: ProviderReceiptRepository,
  domainEvents: DomainEventService,
): ProviderReceiptCaptureService {
  return {
    async recordAdapterReceipt(input) {
      const idempotencyKey = [
        "provider.receipt",
        input.providerType,
        "adapter",
        input.deliveryAttemptId,
        input.providerReceiptId ?? input.providerMessageId ?? input.deliveryAttemptId,
        input.normalizedStatus,
      ].join(":");
      const receipt = {
        id: buildStableEntityId("provider-receipt", [
          input.organizationId,
          idempotencyKey,
        ]),
        organizationId: input.organizationId,
        tenantId: input.organizationId,
        providerType: input.providerType as ProviderReceipt["providerType"],
        providerEventType: input.providerEventType,
        providerMessageId: input.providerMessageId,
        providerCorrelationId: input.providerCorrelationId,
        providerReceiptId: input.providerReceiptId,
        deliveryAttemptId: input.deliveryAttemptId,
        deliveryPlanId: input.deliveryPlanId,
        sourceWebhookEventId: null,
        correlationId: input.correlationId,
        causationId: input.causationId,
        idempotencyKey,
        normalizedStatus: input.normalizedStatus,
        rawStatus: input.rawStatus,
        receivedAt: input.now,
        processedAt: null,
        reconciliationStatus: "pending" as const,
        reconciliationReason: null,
        createdAt: input.now,
        updatedAt: input.now,
        metadata: input.metadata ?? {},
      };
      try {
        await receipts.create(receipt);
      } catch (error) {
        if (!isAlreadyExistsError(error)) {
          throw error;
        }
        return;
      }
      await domainEvents.record({
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
        summary: `Provider adapter receipt ${receipt.id} recorded.`,
        correlationId: receipt.correlationId,
        reason: receipt.providerEventType,
        payload: {
          receiptId: receipt.id,
          deliveryAttemptId: receipt.deliveryAttemptId,
          deliveryPlanId: receipt.deliveryPlanId,
          providerType: receipt.providerType,
          normalizedStatus: receipt.normalizedStatus,
          sourceWebhookEventId: null,
        } as never,
      });
    },
  };
}
