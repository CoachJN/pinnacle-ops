import "server-only";

import type { ProviderReceipt } from "@/modules/provider-runtime/domain/provider-receipt";
import type { ProviderWebhookEvent } from "@/modules/provider-runtime/domain/provider-webhook-event";
import type { ProviderReceiptRepository, ProviderWebhookEventRepository } from "@/modules/provider-runtime/server/provider-receipt-repository";
import type { ProviderHealthService } from "@/modules/provider-runtime/server/provider-health-service";
import { serviceOk, type ServiceResult } from "@/server/services";
import type { EntityId } from "@/types/entity";

export interface ProviderReceiptDiagnosticsService {
  getSummary(input: {
    organizationId: EntityId;
    limit?: number;
  }): Promise<ServiceResult<{
    receiptCounts: {
      total: number;
      pending: number;
      processed: number;
      duplicates: number;
      failures: number;
    };
    duplicateWebhookCount: number;
    delayedReceiptSuppressionCount: number;
    replayNoopCount: number;
    averageProcessingLatencyMs: number;
    providerHealth: Awaited<ReturnType<ProviderHealthService["getSummary"]>> extends ServiceResult<infer TValue> ? TValue : never;
    recentReceipts: ProviderReceipt[];
    recentWebhookEvents: ProviderWebhookEvent[];
  }>>;
}

export function createProviderReceiptDiagnosticsService(
  receipts: ProviderReceiptRepository,
  webhookEvents: ProviderWebhookEventRepository,
  health: ProviderHealthService,
): ProviderReceiptDiagnosticsService {
  return {
    async getSummary(input) {
      const [recentReceipts, recentWebhookEvents, providerHealth] = await Promise.all([
        receipts.listByOrganizationId({
          organizationId: input.organizationId,
          limit: input.limit ?? 50,
        }),
        webhookEvents.listByOrganizationId({
          organizationId: input.organizationId,
          limit: input.limit ?? 50,
        }),
        health.getSummary({ organizationId: input.organizationId }),
      ]);

      const latencies = recentReceipts
        .filter((receipt) => receipt.processedAt)
        .map((receipt) => new Date(receipt.processedAt!).getTime() - new Date(receipt.receivedAt).getTime())
        .filter((value) => Number.isFinite(value) && value >= 0);

      return serviceOk({
        receiptCounts: {
          total: recentReceipts.length,
          pending: recentReceipts.filter((item) => item.reconciliationStatus === "pending").length,
          processed: recentReceipts.filter((item) => item.reconciliationStatus === "processed").length,
          duplicates: recentReceipts.filter((item) => item.reconciliationStatus === "duplicate").length,
          failures: recentReceipts.filter((item) => item.reconciliationStatus === "failed").length,
        },
        duplicateWebhookCount: Math.max(
          0,
          recentWebhookEvents.length - new Set(recentWebhookEvents.map((item) => item.idempotencyKey)).size,
        ),
        delayedReceiptSuppressionCount: recentReceipts.filter(
          (item) => item.reconciliationReason === "late_success_retry_suppressed",
        ).length,
        replayNoopCount: recentReceipts.filter((item) => item.reconciliationStatus === "duplicate").length,
        averageProcessingLatencyMs:
          latencies.length > 0 ? Math.round(latencies.reduce((sum, value) => sum + value, 0) / latencies.length) : 0,
        providerHealth: providerHealth.ok
          ? providerHealth.value
          : {
              duplicateWebhookCount: 0,
              reconciliationFailures: 0,
              pendingReceiptCount: 0,
              providerDeliverySummaries: [],
            },
        recentReceipts: [...recentReceipts],
        recentWebhookEvents: [...recentWebhookEvents],
      });
    },
  };
}
