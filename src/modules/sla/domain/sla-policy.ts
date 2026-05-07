import type { DomainEvent, DomainEventType } from "@/server/events/types";
import type { IsoDateTimeString } from "@/types/entity";
import {
  SLA_TARGET_ENTITY_TYPES,
  SLA_TIMER_TYPES,
  type SlaTargetEntityType,
  type SlaTimerType,
} from "./sla-timer";

export interface SlaPolicyDefinition {
  type: SlaTimerType;
  version: string;
  targetEntityType: SlaTargetEntityType;
  durationMs: number;
  description: string;
  triggerEventTypes: readonly DomainEventType[];
}

export const WORK_ORDER_FIRST_RESPONSE_SLA_POLICY: SlaPolicyDefinition = {
  type: SLA_TIMER_TYPES.WorkOrderFirstResponseDue,
  version: "work_order.first_response_due.v1",
  targetEntityType: SLA_TARGET_ENTITY_TYPES.WorkOrder,
  durationMs: 4 * 60 * 60 * 1000,
  description:
    "Requires an internal first response on a newly created work order within four hours.",
  triggerEventTypes: [
    "work_order_created",
    "lifecycle_transitioned",
    "communication_message_created",
  ],
};

export function resolveSlaDueAt(
  event: Pick<DomainEvent, "occurredAt">,
  policy: SlaPolicyDefinition = WORK_ORDER_FIRST_RESPONSE_SLA_POLICY,
): IsoDateTimeString {
  return new Date(Date.parse(event.occurredAt) + policy.durationMs).toISOString();
}

export function isSupportedSlaPolicyEventType(eventType: DomainEventType): boolean {
  return WORK_ORDER_FIRST_RESPONSE_SLA_POLICY.triggerEventTypes.includes(eventType);
}
