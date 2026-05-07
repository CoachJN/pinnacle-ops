import "server-only";

import type { WorkerHandlerDefinition } from "@/modules/runtime";
import type { ProviderReceiptProcessJobPayload } from "@/modules/provider-runtime/domain/provider-job";
import type { DomainServices } from "@/server/services";

export function createProviderReceiptHandler(): WorkerHandlerDefinition<DomainServices> {
  return {
    type: "provider.receipt.process",
    description: "Reconciles persisted provider receipts back into canonical transport attempts.",
    async handle(context) {
      const payload = context.payload as Partial<ProviderReceiptProcessJobPayload>;
      if (payload.payloadVersion !== "v1") {
        return {
          success: false,
          retryable: false,
          message: "Unsupported provider receipt payload version.",
          errorCode: "provider_receipt_payload_version_invalid",
          errorDetails: {},
        };
      }
      if (typeof payload.receiptId !== "string" || !payload.receiptId.trim()) {
        return {
          success: false,
          retryable: false,
          message: "receiptId is required.",
          errorCode: "provider_receipt_id_missing",
          errorDetails: {},
        };
      }

      const reconciled = await context.services.providerRuntime.reconciliation.reconcileReceipt({
        organizationId: context.organizationId,
        receiptId: payload.receiptId,
        now: context.startedAt,
      });
      if (!reconciled.ok) {
        return {
          success: false,
          retryable: true,
          message: reconciled.error.safeMessage,
          errorCode: reconciled.error.code,
          errorDetails: {},
        };
      }

      return {
        success: true,
        message: `Provider receipt ${payload.receiptId} processed.`,
        metadata: {
          ...reconciled.value,
        },
      };
    },
  };
}
