import "server-only";

import { type SlaScanFinding } from "@/modules/sla";
import { serviceOk, type ServiceResult } from "@/server/services";
import { nowIso } from "@/server/services/types";
import type { SlaTimerScannerService } from "./sla-timer-scanner-service";
import type { SlaScanCursorRepository } from "./sla-scan-cursor-repository";
import type { SlaTimerRepository } from "./sla-timer-repository";

export interface SlaScanDiagnosticsService {
  getSummary(input: {
    organizationId: string;
    dueBefore?: string;
    limit?: number;
    timerType?: string;
  }): Promise<
    ServiceResult<{
      overdueTimers: readonly SlaScanFinding[];
      timersMissingActiveJobs: number;
      staleJobReferences: number;
      orphanedTimers: number;
      recentScanRuns: readonly unknown[];
      repairedTimersCount: number;
      enqueueRepairCount: number;
      latestScanLatencyMs: number | null;
      timersByTypeAndStatus: ReadonlyArray<{ type: string; status: string; count: number }>;
      cursorSummaries: ReadonlyArray<{
        id: string;
        scanType: string;
        timerType: string | null;
        status: string;
        lastScannedDueAt: string | null;
        lastScannedId: string | null;
        lastCompletedAt: string | null;
      }>;
    }>
  >;
}

export function createSlaScanDiagnosticsService(
  dependencies: {
    scanner: SlaTimerScannerService;
    timers: SlaTimerRepository;
    scanCursors: SlaScanCursorRepository;
  },
): SlaScanDiagnosticsService {
  return {
    async getSummary(input) {
      const [timers, cursors, scan] = await Promise.all([
        dependencies.timers.listByOrganizationId(input.organizationId, {
          limit: Math.max(input.limit ?? 50, 200),
        }),
        dependencies.scanCursors.listByOrganizationId(input.organizationId, {
          limit: 25,
        }),
        dependencies.scanner.scan({
          organizationId: input.organizationId,
          dueBefore: input.dueBefore ?? nowIso(),
          limit: input.limit ?? 50,
          timerType: input.timerType as never,
          now: input.dueBefore ?? nowIso(),
          dryRun: true,
          useCursor: false,
          repair: false,
          correlationId: `sla-diagnostics:${input.organizationId}`,
          audit: {
            organizationId: input.organizationId,
            actor: { userId: "system", role: "system" },
            now: input.dueBefore ?? nowIso(),
          },
          enqueueRuntimeJob: async () => {
            throw new Error("Diagnostics mode must not enqueue runtime jobs.");
          },
        }),
      ]);
      if (!scan.ok) {
        return scan;
      }

      const timersByTypeAndStatus = [...timers.items.reduce<Map<string, number>>((accumulator, timer) => {
        accumulator.set(`${timer.type}:${timer.status}`, (accumulator.get(`${timer.type}:${timer.status}`) ?? 0) + 1);
        return accumulator;
      }, new Map())]
        .map(([key, count]) => {
          const [type, status] = key.split(":");
          return { type, status, count };
        })
        .sort((left, right) => left.type.localeCompare(right.type) || left.status.localeCompare(right.status));

      const recentScanRuns = cursors.items
        .flatMap((cursor) => cursor.recentRuns)
        .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
        .slice(0, input.limit ?? 20);

      return serviceOk({
        overdueTimers: scan.value.findings,
        timersMissingActiveJobs: scan.value.missingActiveJobCount,
        staleJobReferences: scan.value.staleJobReferenceCount,
        orphanedTimers: scan.value.orphanedTimerCount,
        recentScanRuns,
        repairedTimersCount:
          recentScanRuns.reduce((sum, run) => sum + (typeof run.repairedTimerCount === "number" ? run.repairedTimerCount : 0), 0),
        enqueueRepairCount:
          recentScanRuns.reduce((sum, run) => sum + (typeof run.enqueueRepairCount === "number" ? run.enqueueRepairCount : 0), 0),
        latestScanLatencyMs:
          typeof recentScanRuns[0]?.latencyMs === "number" ? recentScanRuns[0].latencyMs : null,
        timersByTypeAndStatus,
        cursorSummaries: cursors.items.map((cursor) => ({
          id: cursor.id,
          scanType: cursor.scanType,
          timerType: cursor.timerType,
          status: cursor.status,
          lastScannedDueAt: cursor.lastScannedDueAt,
          lastScannedId: cursor.lastScannedId,
          lastCompletedAt: cursor.lastCompletedAt,
        })),
      });
    },
  };
}
