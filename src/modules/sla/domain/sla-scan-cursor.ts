import type { EntityId, IsoDateTimeString } from "@/types/entity";

export const SLA_SCAN_TYPES = {
  OverdueTimers: "overdue_timers",
} as const;

export type SlaScanType =
  (typeof SLA_SCAN_TYPES)[keyof typeof SLA_SCAN_TYPES];

export const SLA_SCAN_CURSOR_STATUSES = {
  Idle: "idle",
  Running: "running",
  Completed: "completed",
  Failed: "failed",
} as const;

export type SlaScanCursorStatus =
  (typeof SLA_SCAN_CURSOR_STATUSES)[keyof typeof SLA_SCAN_CURSOR_STATUSES];

export interface SlaScanRunSummary {
  runId: string;
  scanType: SlaScanType;
  startedAt: IsoDateTimeString;
  completedAt: IsoDateTimeString | null;
  status: SlaScanCursorStatus;
  latencyMs: number | null;
  scannedCount: number;
  overdueCount: number;
  missingActiveJobCount: number;
  staleJobReferenceCount: number;
  orphanedTimerCount: number;
  repairedTimerCount: number;
  enqueueRepairCount: number;
  cursorDueAt: IsoDateTimeString | null;
  cursorId: EntityId | null;
}

export interface SlaScanCursor {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  scanType: SlaScanType;
  timerType: string | null;
  lastScannedDueAt: IsoDateTimeString | null;
  lastScannedId: EntityId | null;
  lastCompletedAt: IsoDateTimeString | null;
  status: SlaScanCursorStatus;
  correlationId: string;
  recentRuns: readonly SlaScanRunSummary[];
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}
