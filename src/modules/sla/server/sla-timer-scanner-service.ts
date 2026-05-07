import "server-only";

import {
  WORKER_JOB_STATUSES,
  type WorkerJob,
} from "@/modules/runtime";
import type { WorkerQueueRepository } from "@/modules/runtime/server/worker-queue-repository";
import {
  SLA_SCAN_ACTIONS,
  SLA_SCAN_CURSOR_STATUSES,
  SLA_SCAN_FINDING_TYPES,
  SLA_SCAN_TYPES,
  type SlaScanBatchResult,
  type SlaScanCursor,
  type SlaScanFinding,
  type SlaScanRunSummary,
  type SlaTimer,
} from "@/modules/sla";
import { serviceOk, type ServiceAuditContext, type ServiceResult } from "@/server/services";
import { nowIso } from "@/server/services/types";
import type { WorkerDeadLetterRepositoryAdapter } from "@/modules/runtime/server/worker-queue-repository";
import type { SlaRuntimeRepairService } from "./sla-runtime-repair-service";
import type { SlaScanCursorRepository } from "./sla-scan-cursor-repository";
import type { SlaTimerRepository } from "./sla-timer-repository";

const ACTIVE_JOB_STATUSES = [
  WORKER_JOB_STATUSES.Queued,
  WORKER_JOB_STATUSES.Leased,
  WORKER_JOB_STATUSES.Running,
] as const;

const TERMINAL_JOB_STATUSES = [
  WORKER_JOB_STATUSES.Succeeded,
  WORKER_JOB_STATUSES.Failed,
  WORKER_JOB_STATUSES.DeadLettered,
  WORKER_JOB_STATUSES.Cancelled,
] as const;

export interface SlaTimerScannerService {
  scan(input: {
    organizationId: string;
    dueBefore: string;
    limit: number;
    timerType?: SlaTimer["type"];
    timers?: readonly SlaTimer[];
    now?: string;
    dryRun?: boolean;
    useCursor?: boolean;
    repair?: boolean;
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

export function createSlaTimerScannerService(
  dependencies: {
    timers: SlaTimerRepository;
    scanCursors: SlaScanCursorRepository;
    jobs: WorkerQueueRepository;
    deadLetters: WorkerDeadLetterRepositoryAdapter;
    repair: SlaRuntimeRepairService;
  },
): SlaTimerScannerService {
  return {
    async scan(input) {
      const startedAt = input.now ?? nowIso();
      const cursor = input.useCursor
        ? await getOrCreateScanCursor(dependencies.scanCursors, {
            organizationId: input.organizationId,
            timerType: input.timerType ?? null,
            correlationId: input.correlationId,
            now: startedAt,
          })
        : null;

      if (cursor && !input.dryRun) {
        await dependencies.scanCursors.save({
          ...cursor,
          status: SLA_SCAN_CURSOR_STATUSES.Running,
          correlationId: input.correlationId,
          updatedAt: startedAt,
        });
      }

      try {
        const batch = input.timers
          ? {
              items: [...input.timers]
                .sort((left, right) => left.dueAt.localeCompare(right.dueAt) || left.id.localeCompare(right.id))
                .slice(0, input.limit),
              count: input.timers.length,
            }
          : await dependencies.timers.scanScheduledDueTimers({
              organizationId: input.organizationId,
              dueBefore: input.dueBefore,
              limit: input.limit,
              type: input.timerType,
              after:
                input.useCursor && cursor?.lastScannedDueAt && cursor.lastScannedId
                  ? {
                      dueAt: cursor.lastScannedDueAt,
                      id: cursor.lastScannedId,
                    }
                  : null,
            });

        const findings: SlaScanFinding[] = [];
        let repairedTimerCount = 0;
        let enqueueRepairCount = 0;

        for (const timer of batch.items) {
          const finding = await inspectTimer(dependencies.jobs, timer);
          findings.push(finding);

          if (!input.repair || input.dryRun) {
            continue;
          }

          const repaired = await dependencies.repair.repairFinding({
            finding,
            now: startedAt,
            enqueueRuntimeJob: input.enqueueRuntimeJob,
          });
          if (!repaired.ok) {
            return repaired;
          }
          if (repaired.value.repaired) {
            repairedTimerCount += 1;
          }
          if (repaired.value.enqueued) {
            enqueueRepairCount += 1;
          }
        }

        const completedAt = nowIso();
        const latencyMs = Date.parse(completedAt) - Date.parse(startedAt);
        const lastTimer = batch.items[batch.items.length - 1] ?? null;
        const result: SlaScanBatchResult = {
          scanType: SLA_SCAN_TYPES.OverdueTimers,
          organizationId: input.organizationId,
          startedAt,
          completedAt,
          latencyMs,
          dryRun: input.dryRun ?? false,
          scannedCount: batch.items.length,
          overdueCount: batch.items.length,
          missingActiveJobCount: findings.filter(
            (finding) => finding.finding === SLA_SCAN_FINDING_TYPES.MissingActiveJob,
          ).length,
          staleJobReferenceCount: findings.filter(
            (finding) => finding.finding === SLA_SCAN_FINDING_TYPES.StaleJobReference,
          ).length,
          orphanedTimerCount: findings.filter(
            (finding) => finding.finding === SLA_SCAN_FINDING_TYPES.OrphanedTimer,
          ).length,
          repairedTimerCount,
          enqueueRepairCount,
          findings,
          cursor: {
            id: cursor?.id ?? `dry-run:${input.organizationId}:${input.timerType ?? "all"}`,
            previousDueAt: cursor?.lastScannedDueAt ?? null,
            previousId: cursor?.lastScannedId ?? null,
            nextDueAt: lastTimer?.dueAt ?? cursor?.lastScannedDueAt ?? null,
            nextId: lastTimer?.id ?? cursor?.lastScannedId ?? null,
            advanced: lastTimer !== null,
          },
        };

        if (cursor && !input.dryRun) {
          const runSummary: SlaScanRunSummary = {
            runId: `${cursor.id}:${startedAt}`,
            scanType: SLA_SCAN_TYPES.OverdueTimers,
            startedAt,
            completedAt,
            status: SLA_SCAN_CURSOR_STATUSES.Completed,
            latencyMs,
            scannedCount: result.scannedCount,
            overdueCount: result.overdueCount,
            missingActiveJobCount: result.missingActiveJobCount,
            staleJobReferenceCount: result.staleJobReferenceCount,
            orphanedTimerCount: result.orphanedTimerCount,
            repairedTimerCount,
            enqueueRepairCount,
            cursorDueAt: result.cursor.nextDueAt,
            cursorId: result.cursor.nextId,
          };
          await dependencies.scanCursors.save({
            ...cursor,
            lastScannedDueAt: result.cursor.nextDueAt,
            lastScannedId: result.cursor.nextId,
            lastCompletedAt: completedAt,
            status: SLA_SCAN_CURSOR_STATUSES.Completed,
            correlationId: input.correlationId,
            recentRuns: [runSummary, ...cursor.recentRuns].slice(0, 10),
            updatedAt: completedAt,
          });
        }

        return serviceOk(result);
      } catch (error) {
        if (cursor && !input.dryRun) {
          await dependencies.scanCursors.save({
            ...cursor,
            status: SLA_SCAN_CURSOR_STATUSES.Failed,
            correlationId: input.correlationId,
            updatedAt: nowIso(),
          });
        }
        throw error;
      }
    },
  };
}

async function getOrCreateScanCursor(
  repository: SlaScanCursorRepository,
  input: {
    organizationId: string;
    timerType: string | null;
    correlationId: string;
    now: string;
  },
): Promise<SlaScanCursor> {
  const existing = await repository.findByScanType({
    organizationId: input.organizationId,
    scanType: SLA_SCAN_TYPES.OverdueTimers,
    timerType: input.timerType,
  });
  if (existing) {
    return existing;
  }

  const created: SlaScanCursor = {
    id: buildScanCursorId(input.organizationId, input.timerType),
    organizationId: input.organizationId,
    tenantId: input.organizationId,
    scanType: SLA_SCAN_TYPES.OverdueTimers,
    timerType: input.timerType,
    lastScannedDueAt: null,
    lastScannedId: null,
    lastCompletedAt: null,
    status: SLA_SCAN_CURSOR_STATUSES.Idle,
    correlationId: input.correlationId,
    recentRuns: [],
    createdAt: input.now,
    updatedAt: input.now,
  };
  await repository.create(created);
  return created;
}

async function inspectTimer(
  jobs: WorkerQueueRepository,
  timer: SlaTimer,
): Promise<SlaScanFinding> {
  const activeJobs = await jobs.listJobsByTimer({
    organizationId: timer.organizationId,
    timerId: timer.id,
    statuses: ACTIVE_JOB_STATUSES,
    limit: 10,
  });
  const activeJob = activeJobs.items[0] ?? null;
  const referencedJob = timer.runtimeJobId
    ? await jobs.getJobById(timer.runtimeJobId)
    : null;

  if (activeJob) {
    if (timer.runtimeJobId === activeJob.id) {
      return {
        timer,
        timerType: timer.type,
        finding: SLA_SCAN_FINDING_TYPES.Healthy,
        action: SLA_SCAN_ACTIONS.None,
        referencedJobId: referencedJob?.id ?? timer.runtimeJobId,
        referencedJobStatus: referencedJob?.status ?? activeJob.status,
        activeJobId: activeJob.id,
        activeJobStatus: activeJob.status,
        staleReason: null,
      };
    }

    return {
      timer,
      timerType: timer.type,
      finding: SLA_SCAN_FINDING_TYPES.StaleJobReference,
      action: SLA_SCAN_ACTIONS.AttachActiveJob,
      referencedJobId: referencedJob?.id ?? timer.runtimeJobId,
      referencedJobStatus: referencedJob?.status ?? null,
      activeJobId: activeJob.id,
      activeJobStatus: activeJob.status,
      staleReason:
        timer.runtimeJobId === null
          ? "Timer is missing a runtime job reference."
          : "Timer runtime job reference does not point at the active evaluation job.",
    };
  }

  if (timer.runtimeJobId === null) {
    return {
      timer,
      timerType: timer.type,
      finding: SLA_SCAN_FINDING_TYPES.MissingActiveJob,
      action: SLA_SCAN_ACTIONS.EnqueueRepair,
      referencedJobId: null,
      referencedJobStatus: null,
      activeJobId: null,
      activeJobStatus: null,
      staleReason: "Timer has no active evaluation job.",
    };
  }

  if (!referencedJob || referencedJob.organizationId !== timer.organizationId) {
    return {
      timer,
      timerType: timer.type,
      finding: SLA_SCAN_FINDING_TYPES.OrphanedTimer,
      action: SLA_SCAN_ACTIONS.EnqueueRepair,
      referencedJobId: timer.runtimeJobId,
      referencedJobStatus: null,
      activeJobId: null,
      activeJobStatus: null,
      staleReason: "Timer references a missing runtime job.",
    };
  }

  if (isTerminalJobStatus(referencedJob.status)) {
    return {
      timer,
      timerType: timer.type,
      finding: SLA_SCAN_FINDING_TYPES.TerminalJobWithoutTerminalTimerState,
      action: SLA_SCAN_ACTIONS.EnqueueRepair,
      referencedJobId: referencedJob.id,
      referencedJobStatus: referencedJob.status,
      activeJobId: null,
      activeJobStatus: null,
      staleReason: "Referenced runtime job is terminal while the timer remains scheduled.",
    };
  }

  return {
    timer,
    timerType: timer.type,
    finding: SLA_SCAN_FINDING_TYPES.Healthy,
    action: SLA_SCAN_ACTIONS.None,
    referencedJobId: referencedJob.id,
    referencedJobStatus: referencedJob.status,
    activeJobId: referencedJob.id,
    activeJobStatus: referencedJob.status,
    staleReason: null,
  };
}

function buildScanCursorId(organizationId: string, timerType: string | null): string {
  return [
    "sla-scan-cursor",
    organizationId,
    SLA_SCAN_TYPES.OverdueTimers,
    timerType ?? "all",
  ].join(":");
}

function isTerminalJobStatus(status: WorkerJob["status"]): boolean {
  return (
    status === WORKER_JOB_STATUSES.Succeeded ||
    status === WORKER_JOB_STATUSES.Failed ||
    status === WORKER_JOB_STATUSES.DeadLettered ||
    status === WORKER_JOB_STATUSES.Cancelled
  );
}
