import "server-only";

import type { WorkerHandlerDefinition } from "@/modules/runtime";
import type { ProviderReceipt } from "@/modules/provider-runtime";
import type { DomainServices } from "@/server/services";

export function createProviderReconciliationSweepHandler(): WorkerHandlerDefinition<DomainServices> {
  return {
    type: "provider.reconciliation.sweep",
    description: "Scans unresolved provider receipts and enqueues bounded reconciliation jobs.",
    async handle(context) {
      const payload = context.payload as {
        payloadVersion?: string;
        batchLimit?: number;
      };
      if (payload.payloadVersion !== "v1") {
        return {
          success: false,
          retryable: false,
          message: "Unsupported provider sweep payload version.",
          errorCode: "provider_sweep_payload_version_invalid",
          errorDetails: {},
        };
      }

      const receipts = await context.services.providerRuntime.storage.receipts.listByOrganizationId({
        organizationId: context.organizationId,
        limit: normalizeBatchLimit(payload.batchLimit),
      });
      const candidates = receipts
        .filter((item) => shouldEnqueueReconciliation(item))
        .slice(0, normalizeBatchLimit(payload.batchLimit));

      let enqueuedCount = 0;
      let existingCount = 0;
      for (const receipt of candidates) {
        const job = await context.services.runtime.jobs.enqueue({
          organizationId: context.organizationId,
          actor: { userId: "system", role: "system" },
          now: context.startedAt,
          type: "provider.receipt.process",
          payloadVersion: "v1",
          payload: {
            payloadVersion: "v1",
            receiptId: receipt.id,
            reason: "operator_reconcile",
          },
          idempotencyKey: `provider.reconciliation.sweep:${receipt.id}`,
          correlationId: receipt.correlationId,
          causationId: context.job.id,
          sourceEventId: receipt.sourceWebhookEventId,
          runAfter: context.startedAt,
          maxAttempts: 3,
        });
        if (!job.ok) {
          return {
            success: false,
            retryable: true,
            message: job.error.safeMessage,
            errorCode: job.error.code,
            errorDetails: {},
          };
        }
        if (job.value.createdAt === context.startedAt) {
          enqueuedCount += 1;
        } else {
          existingCount += 1;
        }
      }

      return {
        success: true,
        message: `Provider reconciliation sweep evaluated ${candidates.length} receipts.`,
        metadata: {
          candidateCount: candidates.length,
          enqueuedCount,
          existingCount,
        },
      };
    },
  };
}

function shouldEnqueueReconciliation(receipt: ProviderReceipt): boolean {
  return (
    receipt.reconciliationStatus === "pending" ||
    receipt.reconciliationStatus === "failed" ||
    receipt.reconciliationReason === "delivery_attempt_not_found"
  );
}

function normalizeBatchLimit(value: number | undefined): number {
  return Math.max(1, Math.min(value ?? 50, 50));
}
