import type { EntityId } from "@/types/entity";

export interface ProviderCorrelation {
  deliveryAttemptId: EntityId | null;
  deliveryPlanId: EntityId | null;
  correlatedBy:
    | "delivery_attempt_id"
    | "provider_receipt_id"
    | "provider_message_id"
    | "provider_correlation_id"
    | "unresolved";
}
