import "server-only";

import type {
  ProviderReceipt,
  ProviderReceiptReconciliationStatus,
} from "@/modules/provider-runtime/domain/provider-receipt";
import type { ProviderWebhookEvent } from "@/modules/provider-runtime/domain/provider-webhook-event";
import type { EntityId } from "@/types/entity";

export interface ProviderReceiptRepository {
  newId(): EntityId;
  getById(id: EntityId): Promise<ProviderReceipt | null>;
  create(receipt: ProviderReceipt): Promise<void>;
  save(receipt: ProviderReceipt): Promise<void>;
  findByIdempotencyKey(input: {
    organizationId: EntityId;
    idempotencyKey: string;
  }): Promise<ProviderReceipt | null>;
  findLatestForAttempt(input: {
    organizationId: EntityId;
    deliveryAttemptId: EntityId;
  }): Promise<ProviderReceipt | null>;
  listByOrganizationId(input: {
    organizationId: EntityId;
    limit?: number;
    reconciliationStatus?: ProviderReceiptReconciliationStatus;
  }): Promise<readonly ProviderReceipt[]>;
  listByDeliveryAttemptId(input: {
    organizationId: EntityId;
    deliveryAttemptId: EntityId;
    limit?: number;
  }): Promise<readonly ProviderReceipt[]>;
}

export interface ProviderWebhookEventRepository {
  newId(): EntityId;
  getById(id: EntityId): Promise<ProviderWebhookEvent | null>;
  create(event: ProviderWebhookEvent): Promise<void>;
  save(event: ProviderWebhookEvent): Promise<void>;
  findByIdempotencyKey(input: {
    organizationId: EntityId;
    idempotencyKey: string;
  }): Promise<ProviderWebhookEvent | null>;
  listByOrganizationId(input: {
    organizationId: EntityId;
    limit?: number;
  }): Promise<readonly ProviderWebhookEvent[]>;
}
