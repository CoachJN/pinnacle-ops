import type { DeliveryPlan } from "@/modules/delivery";
import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { DeliveryAttempt, TransportAdapterType } from "./delivery-attempt";
import type { DeliveryReceipt } from "./delivery-receipt";
import type { TransportResult } from "./transport-result";

export interface NormalizedTransportExecutionPayload {
  organizationId: EntityId;
  now: IsoDateTimeString;
  deliveryPlan: Pick<
    DeliveryPlan,
    | "id"
    | "deliveryType"
    | "channel"
    | "targetEntityType"
    | "targetEntityId"
    | "recipientType"
    | "recipientId"
    | "recipientAddress"
    | "templateId"
    | "templateVersion"
    | "priority"
    | "correlationId"
    | "causationId"
    | "sourceEventId"
  >;
  attempt: Pick<
    DeliveryAttempt,
    | "id"
    | "deliveryPlanId"
    | "retryCount"
    | "correlationId"
    | "causationId"
    | "sourceEventId"
    | "idempotencyKey"
  >;
}

export interface TransportAdapterExecutionContext {
  payload: NormalizedTransportExecutionPayload;
}

export interface TransportAdapter {
  adapterType: TransportAdapterType;
  supportsChannel(channel: DeliveryPlan["channel"]): boolean;
  execute(input: TransportAdapterExecutionContext): Promise<TransportResult>;
}

export function mergeReceipt(
  existing: DeliveryReceipt,
  next?: Partial<DeliveryReceipt>,
): DeliveryReceipt {
  return {
    deliveryPlanId: existing.deliveryPlanId,
    deliveryAttemptId: existing.deliveryAttemptId,
    providerMessageId: next?.providerMessageId ?? existing.providerMessageId,
    providerCorrelationId: next?.providerCorrelationId ?? existing.providerCorrelationId,
    providerReceiptId: next?.providerReceiptId ?? existing.providerReceiptId,
  };
}
