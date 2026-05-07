import type { EntityId } from "@/types/entity";

export interface DeliveryReceipt {
  deliveryPlanId: EntityId;
  deliveryAttemptId: EntityId;
  providerMessageId: string | null;
  providerCorrelationId: string | null;
  providerReceiptId: string | null;
}
