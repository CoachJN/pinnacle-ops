import "server-only";

import type { WorkerRuntimeService } from "@/modules/runtime/server/worker-runtime-service";
import type { ProviderReceiptRepository } from "@/modules/provider-runtime/server/provider-receipt-repository";
import type { RuntimeLoopCoordinator } from "./runtime-loop-coordinator";
import { RUNTIME_LOOP_TYPES } from "../domain/runtime-loop";

export interface ProviderReconciliationLoopRunner {
  runCycle(input: {
    organizationId: string;
    leaseOwner: string;
    now?: string;
    cadence: number;
    concurrencyLimit: number;
    leaseDurationMs: number;
    batchLimit?: number;
  }): ReturnType<RuntimeLoopCoordinator["runCycle"]>;
}

export function createProviderReconciliationLoopRunner(
  coordinator: RuntimeLoopCoordinator,
  runtime: WorkerRuntimeService,
  receipts: ProviderReceiptRepository,
): ProviderReconciliationLoopRunner {
  return {
    runCycle(input) {
      return coordinator.runCycle({
        organizationId: input.organizationId,
        loopType: RUNTIME_LOOP_TYPES.ProviderReconciliation,
        leaseOwner: input.leaseOwner,
        cadence: input.cadence,
        concurrencyLimit: input.concurrencyLimit,
        leaseDurationMs: input.leaseDurationMs,
        now: input.now,
        execute: async () => {
          const now = input.now ?? new Date().toISOString();
          const pendingReceipts = await receipts.listByOrganizationId({
            organizationId: input.organizationId,
            limit: Math.max(1, Math.min(input.batchLimit ?? 50, 50)),
            reconciliationStatus: "pending",
          });
          const cadenceWindow = new Date(
            Math.floor(Date.parse(now) / input.cadence) * input.cadence,
          ).toISOString();
          const job = await runtime.enqueue({
            organizationId: input.organizationId,
            actor: { userId: "system", role: "system" },
            now,
            type: "provider.reconciliation.sweep",
            payloadVersion: "v1",
            payload: {
              payloadVersion: "v1",
              batchLimit: Math.max(1, Math.min(input.batchLimit ?? 50, 50)),
            },
            idempotencyKey: `runtime-loop:provider.reconciliation:${cadenceWindow}`,
            correlationId: `runtime-loop:${input.organizationId}:provider.reconciliation`,
            causationId: `runtime-loop:${input.leaseOwner}:${cadenceWindow}`,
            sourceEventId: null,
            maxAttempts: 3,
          });
          if (!job.ok) {
            throw new Error(job.error.safeMessage);
          }
          return {
            status: pendingReceipts.length > 0 ? "succeeded" : "noop",
            message: `Provider reconciliation evaluated ${pendingReceipts.length} pending receipts.`,
            enqueuedCount: job.value.createdAt === now ? 1 : 0,
            duplicateCount: job.value.createdAt === now ? 0 : 1,
            processedCount: pendingReceipts.length,
            metadata: {
              pendingReceiptCount: pendingReceipts.length,
            },
          };
        },
      });
    },
  };
}
