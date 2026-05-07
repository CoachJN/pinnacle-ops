import type { EntityId } from "@/types/entity";
import type { DeliveryType } from "./delivery-policy";

export interface DeliveryPlanProcessJobPayload extends Record<string, unknown> {
  payloadVersion: "v1";
  action: "plan_from_escalation_event" | "cancel_for_escalation";
  deliveryType: DeliveryType;
  sourceEscalationId?: EntityId;
  sourceEventId?: EntityId;
  sourceEscalationStageNumber?: number | null;
  reason: string;
}
