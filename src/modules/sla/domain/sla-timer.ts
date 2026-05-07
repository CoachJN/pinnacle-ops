import type { DomainEventType } from "@/server/events/types";
import type { EntityId, IsoDateTimeString } from "@/types/entity";

export const SLA_TIMER_TYPES = {
  WorkOrderFirstResponseDue: "work_order.first_response_due",
} as const;

export type SlaTimerType =
  (typeof SLA_TIMER_TYPES)[keyof typeof SLA_TIMER_TYPES];

export const SLA_TIMER_STATUSES = {
  Scheduled: "scheduled",
  Evaluating: "evaluating",
  Satisfied: "satisfied",
  Breached: "breached",
  Cancelled: "cancelled",
  Failed: "failed",
} as const;

export type SlaTimerStatus =
  (typeof SLA_TIMER_STATUSES)[keyof typeof SLA_TIMER_STATUSES];

export const SLA_TARGET_ENTITY_TYPES = {
  WorkOrder: "work_order",
} as const;

export type SlaTargetEntityType =
  (typeof SLA_TARGET_ENTITY_TYPES)[keyof typeof SLA_TARGET_ENTITY_TYPES];

export interface WorkOrderFirstResponseCondition {
  kind: "work_order_first_response";
  workOrderId: EntityId;
  activationEventId: EntityId;
  activationEventType: DomainEventType;
  activationOccurredAt: IsoDateTimeString;
  initialLifecycleStatus: string | null;
}

export type SlaTimerCondition = WorkOrderFirstResponseCondition;

export interface SlaTimer {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  type: SlaTimerType;
  targetEntityType: SlaTargetEntityType;
  targetEntityId: EntityId;
  status: SlaTimerStatus;
  dueAt: IsoDateTimeString;
  policyVersion: string;
  payloadVersion: string;
  condition: SlaTimerCondition;
  sourceEventId: EntityId;
  correlationId: string;
  causationId: string;
  idempotencyKey: string;
  runtimeJobId: EntityId | null;
  evaluatedAt: IsoDateTimeString | null;
  satisfiedAt: IsoDateTimeString | null;
  breachedAt: IsoDateTimeString | null;
  cancelledAt: IsoDateTimeString | null;
  failureReason: string | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}

export interface SlaTimerEvaluateJobPayload extends Record<string, unknown> {
  timerId: EntityId;
  payloadVersion: "v1";
}
