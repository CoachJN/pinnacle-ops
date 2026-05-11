import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { UserRole } from "@/types/permissions";

export const RUNTIME_REPAIR_ACTION_TYPES = {
  DeadLetterReplay: "dead_letter_replay",
  StuckRuntimeRequeue: "stuck_runtime_requeue",
  EventReplayRetry: "event_replay_retry",
  ProviderReconciliationRetry: "provider_reconciliation_retry",
  DeliveryRetryReset: "delivery_retry_reset",
} as const;

export type RuntimeRepairActionType =
  (typeof RUNTIME_REPAIR_ACTION_TYPES)[keyof typeof RUNTIME_REPAIR_ACTION_TYPES];

export const RUNTIME_REPAIR_ACTION_STATUSES = {
  Requested: "requested",
  PendingConfirmation: "pending_confirmation",
  Completed: "completed",
  Noop: "noop",
  Failed: "failed",
} as const;

export type RuntimeRepairActionStatus =
  (typeof RUNTIME_REPAIR_ACTION_STATUSES)[keyof typeof RUNTIME_REPAIR_ACTION_STATUSES];

export interface RuntimeRepairAction {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  actionType: RuntimeRepairActionType;
  status: RuntimeRepairActionStatus;
  targetType:
    | "runtime_dead_letter"
    | "runtime_job"
    | "domain_event"
    | "provider_receipt"
    | "delivery_plan";
  targetId: EntityId;
  idempotencyKey: string;
  correlationId: string;
  causationId: string;
  sourceEventId: EntityId | null;
  requestedByUserId: EntityId;
  requestedByRole: UserRole | "system";
  summary: string;
  metadata: Record<string, unknown>;
  result: Record<string, unknown>;
  requestedAt: IsoDateTimeString;
  completedAt: IsoDateTimeString | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}
