import "server-only";

import type { ProviderReceiptRepository, ProviderWebhookEventRepository } from "@/modules/provider-runtime/server/provider-receipt-repository";
import { serviceOk, type ServiceResult } from "@/server/services";
import type { EntityId } from "@/types/entity";

export interface ProviderHealthService {
  getSummary(input: { organizationId: EntityId }): Promise<ServiceResult<{
    duplicateWebhookCount: number;
    reconciliationFailures: number;
    pendingReceiptCount: number;
    providerDeliverySummaries: Array<{
      providerType: string;
      accepted: number;
      delivered: number;
      failed: number;
    }>;
  }>>;
}

export function createProviderHealthService(
  receipts: ProviderReceiptRepository,
  webhookEvents: ProviderWebhookEventRepository,
): ProviderHealthService {
  return {
    async getSummary(input) {
      const [allReceipts, allWebhooks] = await Promise.all([
        receipts.listByOrganizationId({ organizationId: input.organizationId, limit: 200 }),
        webhookEvents.listByOrganizationId({ organizationId: input.organizationId, limit: 200 }),
      ]);
      const byProvider = new Map<string, { accepted: number; delivered: number; failed: number }>();
      for (const receipt of allReceipts) {
        const existing = byProvider.get(receipt.providerType) ?? { accepted: 0, delivered: 0, failed: 0 };
        if (receipt.normalizedStatus === "accepted" || receipt.normalizedStatus === "queued") {
          existing.accepted += 1;
        } else if (receipt.normalizedStatus === "delivered") {
          existing.delivered += 1;
        } else if (
          receipt.normalizedStatus === "failed" ||
          receipt.normalizedStatus === "bounced" ||
          receipt.normalizedStatus === "rejected"
        ) {
          existing.failed += 1;
        }
        byProvider.set(receipt.providerType, existing);
      }

      return serviceOk({
        duplicateWebhookCount: Math.max(0, allWebhooks.length - new Set(allWebhooks.map((item) => item.idempotencyKey)).size),
        reconciliationFailures: allReceipts.filter((item) => item.reconciliationStatus === "failed").length,
        pendingReceiptCount: allReceipts.filter((item) => item.reconciliationStatus === "pending").length,
        providerDeliverySummaries: [...byProvider.entries()].map(([providerType, counts]) => ({
          providerType,
          accepted: counts.accepted,
          delivered: counts.delivered,
          failed: counts.failed,
        })),
      });
    },
  };
}
