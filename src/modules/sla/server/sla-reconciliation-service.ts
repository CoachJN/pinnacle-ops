import "server-only";

import { validationError } from "@/server/services/errors";
import { serviceFail, serviceOk, type ServiceAuditContext, type ServiceResult } from "@/server/services";
import { nowIso } from "@/server/services/types";
import type { WorkerJob } from "@/modules/runtime";
import type { SlaScanBatchResult } from "@/modules/sla";
import type { SlaTimerScannerService } from "./sla-timer-scanner-service";
import type { SlaTimerRepository } from "./sla-timer-repository";

export interface SlaReconciliationService {
  reconcile(input: {
    organizationId: string;
    timerIds?: readonly string[];
    dueBefore: string;
    limit: number;
    timerType?: string;
    now?: string;
    correlationId: string;
    audit: ServiceAuditContext;
    enqueueRuntimeJob: (input: {
      type: string;
      payload: Record<string, unknown>;
      payloadVersion: "v1";
      idempotencyKey: string;
      runAfter: string;
      correlationId: string;
      causationId: string;
      sourceEventId: string;
    }) => Promise<ServiceResult<WorkerJob>>;
  }): Promise<ServiceResult<SlaScanBatchResult>>;
}

export function createSlaReconciliationService(
  dependencies: {
    scanner: SlaTimerScannerService;
    timers: SlaTimerRepository;
  },
): SlaReconciliationService {
  return {
    async reconcile(input) {
      const now = input.now ?? nowIso();
      if (input.timerIds?.length) {
        if (input.timerIds.length > input.limit) {
          return serviceFail(validationError("timerIds exceed reconcile limit."));
        }

        const loaded = (
          await Promise.all(
            input.timerIds.map(async (timerId) => dependencies.timers.getById(timerId)),
          )
        )
          .filter((timer): timer is NonNullable<typeof timer> => timer !== null)
          .filter((timer) => timer.organizationId === input.organizationId)
          .filter((timer) => timer.status === "scheduled")
          .filter((timer) => (input.timerType ? timer.type === input.timerType : true))
          .sort((left, right) => left.dueAt.localeCompare(right.dueAt) || left.id.localeCompare(right.id))
          .slice(0, input.limit);

        const dueBefore = loaded[loaded.length - 1]?.dueAt ?? input.dueBefore;
        return dependencies.scanner.scan({
          organizationId: input.organizationId,
          dueBefore,
          limit: loaded.length || input.limit,
          timerType: input.timerType as never,
          timers: loaded,
          now,
          dryRun: false,
          useCursor: false,
          repair: true,
          correlationId: input.correlationId,
          audit: input.audit,
          enqueueRuntimeJob: input.enqueueRuntimeJob,
        });
      }

      return dependencies.scanner.scan({
        organizationId: input.organizationId,
        dueBefore: input.dueBefore,
        limit: input.limit,
        timerType: input.timerType as never,
        now,
        dryRun: false,
        useCursor: false,
        repair: true,
        correlationId: input.correlationId,
        audit: input.audit,
        enqueueRuntimeJob: input.enqueueRuntimeJob,
      });
    },
  };
}
