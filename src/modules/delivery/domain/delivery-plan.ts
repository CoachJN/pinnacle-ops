import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { DeliveryChannel } from "./delivery-channel";
import type { DeliveryPriority, DeliveryType } from "./delivery-policy";
import type { DeliveryRecipientType } from "./delivery-target";

export const DELIVERY_PLAN_TARGET_ENTITY_TYPES = {
  WorkOrder: "work_order",
} as const;

export type DeliveryPlanTargetEntityType =
  (typeof DELIVERY_PLAN_TARGET_ENTITY_TYPES)[keyof typeof DELIVERY_PLAN_TARGET_ENTITY_TYPES];

export const DELIVERY_PLAN_STATUSES = {
  Planned: "planned",
  Scheduled: "scheduled",
  Suppressed: "suppressed",
  Cancelled: "cancelled",
  Completed: "completed",
  Failed: "failed",
} as const;

export type DeliveryPlanStatus =
  (typeof DELIVERY_PLAN_STATUSES)[keyof typeof DELIVERY_PLAN_STATUSES];

export interface DeliveryPlan {
  id: EntityId;
  organizationId: EntityId;
  tenantId: EntityId;
  deliveryType: DeliveryType;
  sourceEscalationId: EntityId;
  sourceEscalationStageNumber: number | null;
  sourceEventId: EntityId;
  correlationId: string;
  causationId: string;
  idempotencyKey: string;
  targetEntityType: DeliveryPlanTargetEntityType;
  targetEntityId: EntityId;
  recipientType: DeliveryRecipientType;
  recipientId: EntityId;
  recipientAddress: string;
  channel: DeliveryChannel;
  templateId: string;
  templateVersion: string;
  priority: DeliveryPriority;
  status: DeliveryPlanStatus;
  retryCount: number;
  nextAttemptAt: IsoDateTimeString | null;
  suppressionReason: string | null;
  cancellationReason: string | null;
  activeRuntimeJobId: EntityId | null;
  noopCount: number;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
}
