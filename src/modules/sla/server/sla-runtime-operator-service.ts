import "server-only";

import { createWorkerQueueRepository } from "@/modules/runtime/server/worker-queue-repository";
import { createSlaScanCursorRepository } from "@/modules/sla/server/sla-scan-cursor-repository";
import {
  createSlaRuntimeRepairService,
} from "@/modules/sla/server/sla-runtime-repair-service";
import {
  createSlaScanDiagnosticsService,
} from "@/modules/sla/server/sla-scan-diagnostics-service";
import {
  createSlaReconciliationService,
} from "@/modules/sla/server/sla-reconciliation-service";
import {
  createSlaTimerScannerService,
} from "@/modules/sla/server/sla-timer-scanner-service";
import type { ServiceAuditContext } from "@/server/services";
import { nowIso } from "@/server/services/types";
import type { FirestoreRepositories } from "@/server/repositories";
import type { DomainServices } from "@/server/services";

export interface SlaRuntimeOperatorService {
  scanOverdueTimers(input: {
    organizationId: string;
    dueBefore: string;
    limit: number;
    timerType?: string;
    now?: string;
    dryRun?: boolean;
    audit: ServiceAuditContext;
  }): ReturnType<ReturnType<typeof createSlaTimerScannerService>["scan"]>;
  reconcileTimers(input: {
    organizationId: string;
    dueBefore: string;
    limit: number;
    timerType?: string;
    timerIds?: readonly string[];
    now?: string;
    audit: ServiceAuditContext;
  }): ReturnType<ReturnType<typeof createSlaReconciliationService>["reconcile"]>;
  getDiagnostics(input: {
    organizationId: string;
    dueBefore?: string;
    limit?: number;
    timerType?: string;
  }): ReturnType<ReturnType<typeof createSlaScanDiagnosticsService>["getSummary"]>;
}

export function createSlaRuntimeOperatorService(
  dependencies: {
    repositories: Pick<
      FirestoreRepositories,
      "runtimeJobs" | "runtimeDeadLetters" | "slaTimers" | "slaScanCursors"
    >;
    services: Pick<DomainServices, "runtime" | "sla">;
  },
): SlaRuntimeOperatorService {
  const jobs = createWorkerQueueRepository({
    runtimeJobs: dependencies.repositories.runtimeJobs,
    runtimeDeadLetters: dependencies.repositories.runtimeDeadLetters,
  });
  const scanCursors = createSlaScanCursorRepository({
    slaScanCursors: dependencies.repositories.slaScanCursors,
  });
  const repair = createSlaRuntimeRepairService({
    timers: dependencies.services.sla.timers,
    jobs,
  });
  const scanner = createSlaTimerScannerService({
    timers: dependencies.services.sla.repository,
    scanCursors,
    jobs,
    deadLetters: jobs,
    repair,
  });
  const reconciliation = createSlaReconciliationService({
    scanner,
    timers: dependencies.services.sla.repository,
  });
  const diagnostics = createSlaScanDiagnosticsService({
    scanner,
    timers: dependencies.services.sla.repository,
    scanCursors,
  });

  return {
    scanOverdueTimers(input) {
      return scanner.scan({
        organizationId: input.organizationId,
        dueBefore: input.dueBefore,
        limit: input.limit,
        timerType: input.timerType as never,
        now: input.now,
        dryRun: input.dryRun,
        useCursor: true,
        repair: true,
        correlationId: `sla.scan:${input.organizationId}:${input.dueBefore}`,
        audit: input.audit,
        enqueueRuntimeJob: (jobInput) =>
          dependencies.services.runtime.jobs.enqueue({
            organizationId: input.organizationId,
            actor: { userId: "system", role: "system" },
            type: jobInput.type,
            payload: jobInput.payload,
            payloadVersion: jobInput.payloadVersion,
            idempotencyKey: jobInput.idempotencyKey,
            runAfter: jobInput.runAfter,
            correlationId: jobInput.correlationId,
            causationId: jobInput.causationId,
            sourceEventId: jobInput.sourceEventId,
            now: input.now ?? nowIso(),
          }),
      });
    },
    reconcileTimers(input) {
      return reconciliation.reconcile({
        organizationId: input.organizationId,
        dueBefore: input.dueBefore,
        limit: input.limit,
        timerType: input.timerType,
        timerIds: input.timerIds,
        now: input.now,
        correlationId: `sla.reconcile:${input.organizationId}:${input.dueBefore}`,
        audit: input.audit,
        enqueueRuntimeJob: (jobInput) =>
          dependencies.services.runtime.jobs.enqueue({
            organizationId: input.organizationId,
            actor: { userId: "system", role: "system" },
            type: jobInput.type,
            payload: jobInput.payload,
            payloadVersion: jobInput.payloadVersion,
            idempotencyKey: jobInput.idempotencyKey,
            runAfter: jobInput.runAfter,
            correlationId: jobInput.correlationId,
            causationId: jobInput.causationId,
            sourceEventId: jobInput.sourceEventId,
            now: input.now ?? nowIso(),
          }),
      });
    },
    getDiagnostics(input) {
      return diagnostics.getSummary(input);
    },
  };
}
