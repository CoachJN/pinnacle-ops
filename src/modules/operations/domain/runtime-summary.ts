import type { WorkerDeadLetterRecord, WorkerJob, EventProcessingRecord } from "@/modules/runtime";
import type { DeliveryPlan } from "@/modules/delivery";
import type { DeliveryAttempt } from "@/modules/transport";
import type { EscalationOrchestration } from "@/modules/escalation";
import type { ProviderReceipt } from "@/modules/provider-runtime";
import type { SlaTimer } from "@/modules/sla";
import type { RuntimeAlert } from "./runtime-alert";
import type { RuntimeHealth } from "./runtime-health";
import type { RuntimeProjection } from "./runtime-projection";
import type { RuntimeRepairAction } from "./runtime-repair-action";

export interface RuntimeDeadLetterOperationsSummary {
  totalDeadLetters: number;
  recentDeadLetters: readonly WorkerDeadLetterRecord[];
  missingOriginalJobCount: number;
}

export interface RuntimeReplayOperationsSummary {
  recentEventProcessings: readonly EventProcessingRecord[];
  recentProviderReceipts: readonly ProviderReceipt[];
  replayBacklogCount: number;
  reconciliationFailureCount: number;
}

export interface RuntimeObservabilityDiagnostics {
  projection: RuntimeProjection;
  health: RuntimeHealth;
  alerts: readonly RuntimeAlert[];
  deadLetters: RuntimeDeadLetterOperationsSummary;
  replay: RuntimeReplayOperationsSummary;
  repairHistory: readonly RuntimeRepairAction[];
  freshness: {
    generatedAt: string;
    latestObservedUpdateAt: string | null;
    projectionLagMs: number;
  };
  queueDepth: {
    totalJobs: number;
    queuedJobs: number;
    overdueQueuedJobs: number;
    stuckJobs: number;
  };
  subsystemSnapshots: {
    stuckJobs: readonly WorkerJob[];
    overdueSlaTimers: readonly SlaTimer[];
    failedDeliveryPlans: readonly DeliveryPlan[];
    failedTransportAttempts: readonly DeliveryAttempt[];
    activeEscalations: readonly EscalationOrchestration[];
  };
}

export interface RuntimeCommandCenterSummary {
  projection: RuntimeProjection;
  health: RuntimeHealth;
  activeAlerts: readonly RuntimeAlert[];
  tenantSummary: RuntimeProjection["tenantSummary"];
}
