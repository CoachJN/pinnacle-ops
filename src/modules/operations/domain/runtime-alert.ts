import type { EntityId, IsoDateTimeString } from "@/types/entity";

export const RUNTIME_ALERT_TYPES = {
  ExcessiveDeadLetters: "excessive_dead_letters",
  StuckRuntimeJobs: "stuck_runtime_jobs",
  OverdueSlaEvaluations: "overdue_sla_evaluations",
  ReplayBacklogGrowth: "replay_backlog_growth",
  ProviderReconciliationFailures: "provider_reconciliation_failures",
  RepeatedTransportFailures: "repeated_transport_failures",
  QueueStarvation: "queue_starvation",
  ExcessiveRetryChurn: "excessive_retry_churn",
} as const;

export type RuntimeAlertType =
  (typeof RUNTIME_ALERT_TYPES)[keyof typeof RUNTIME_ALERT_TYPES];

export const RUNTIME_ALERT_STATUSES = {
  Active: "active",
  Resolved: "resolved",
} as const;

export type RuntimeAlertStatus =
  (typeof RUNTIME_ALERT_STATUSES)[keyof typeof RUNTIME_ALERT_STATUSES];

export interface RuntimeAlert {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  dedupKey: string;
  alertType: RuntimeAlertType;
  severity: "warning" | "critical";
  status: RuntimeAlertStatus;
  summary: string;
  metricValue: number;
  threshold: number;
  correlationId: string;
  causationId: string;
  sourceEventId: EntityId | null;
  metadata: Record<string, unknown>;
  firstDetectedAt: IsoDateTimeString;
  lastDetectedAt: IsoDateTimeString;
  resolvedAt: IsoDateTimeString | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}
