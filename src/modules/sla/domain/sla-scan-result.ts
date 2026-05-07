import type { WorkerJobStatus } from "@/modules/runtime";
import type { SlaTimer, SlaTimerType } from "@/modules/sla";
import type { EntityId, IsoDateTimeString } from "@/types/entity";

export const SLA_SCAN_FINDING_TYPES = {
  Healthy: "healthy",
  MissingActiveJob: "missing_active_job",
  StaleJobReference: "stale_job_reference",
  TerminalJobWithoutTerminalTimerState: "terminal_job_without_terminal_timer_state",
  OrphanedTimer: "orphaned_timer",
} as const;

export type SlaScanFindingType =
  (typeof SLA_SCAN_FINDING_TYPES)[keyof typeof SLA_SCAN_FINDING_TYPES];

export const SLA_SCAN_ACTIONS = {
  None: "none",
  AttachActiveJob: "attach_active_job",
  EnqueueRepair: "enqueue_repair",
} as const;

export type SlaScanAction =
  (typeof SLA_SCAN_ACTIONS)[keyof typeof SLA_SCAN_ACTIONS];

export interface SlaScanFinding {
  timer: SlaTimer;
  timerType: SlaTimerType;
  finding: SlaScanFindingType;
  action: SlaScanAction;
  referencedJobId: EntityId | null;
  referencedJobStatus: WorkerJobStatus | null;
  activeJobId: EntityId | null;
  activeJobStatus: WorkerJobStatus | null;
  staleReason: string | null;
}

export interface SlaScanBatchResult {
  scanType: string;
  organizationId: EntityId;
  startedAt: IsoDateTimeString;
  completedAt: IsoDateTimeString;
  latencyMs: number;
  dryRun: boolean;
  scannedCount: number;
  overdueCount: number;
  missingActiveJobCount: number;
  staleJobReferenceCount: number;
  orphanedTimerCount: number;
  repairedTimerCount: number;
  enqueueRepairCount: number;
  findings: readonly SlaScanFinding[];
  cursor: {
    id: EntityId;
    previousDueAt: IsoDateTimeString | null;
    previousId: EntityId | null;
    nextDueAt: IsoDateTimeString | null;
    nextId: EntityId | null;
    advanced: boolean;
  };
}
