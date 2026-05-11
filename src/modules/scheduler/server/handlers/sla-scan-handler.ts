import "server-only";

import type { WorkerHandlerDefinition } from "@/modules/runtime";
import { createSlaRuntimeOperatorService } from "@/modules/sla";
import type { FirestoreRepositories } from "@/server/repositories";
import type { DomainServices } from "@/server/services";

export function createSlaScanHandler(
  repositories: Pick<
    FirestoreRepositories,
    "runtimeJobs" | "runtimeDeadLetters" | "slaTimers" | "slaScanCursors"
  >,
  services: Pick<DomainServices, "runtime" | "sla">,
): WorkerHandlerDefinition<DomainServices> {
  return {
    type: "sla.scan.overdue",
    description: "Scans overdue SLA timers and enqueues bounded evaluation jobs.",
    async handle(context) {
      const payload = context.payload as {
        payloadVersion?: string;
        batchLimit?: number;
      };
      if (payload.payloadVersion !== "v1") {
        return {
          success: false,
          retryable: false,
          message: "Unsupported SLA scan payload version.",
          errorCode: "sla_scan_payload_version_invalid",
          errorDetails: {},
        };
      }

      const operator = createSlaRuntimeOperatorService({
        repositories,
        services,
      });
      const result = await operator.scanOverdueTimers({
        organizationId: context.organizationId,
        dueBefore: context.startedAt,
        limit: normalizeBatchLimit(payload.batchLimit),
        now: context.startedAt,
        dryRun: false,
        audit: {
          organizationId: context.organizationId,
          actor: { userId: "system", role: "system" },
          requestId: context.job.id,
          now: context.startedAt,
        },
      });
      if (!result.ok) {
        return {
          success: false,
          retryable: true,
          message: result.error.safeMessage,
          errorCode: result.error.code,
          errorDetails: {},
        };
      }

      return {
        success: true,
        message: `SLA scan repaired ${result.value.repairedTimerCount} overdue timer findings.`,
        metadata: {
          scannedCount: result.value.scannedCount,
          overdueCount: result.value.overdueCount,
          repairedTimerCount: result.value.repairedTimerCount,
          enqueueRepairCount: result.value.enqueueRepairCount,
          missingActiveJobCount: result.value.missingActiveJobCount,
        },
      };
    },
  };
}

function normalizeBatchLimit(value: number | undefined): number {
  return Math.max(1, Math.min(value ?? 100, 100));
}
