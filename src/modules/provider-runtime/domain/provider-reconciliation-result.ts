import type { EntityId, IsoDateTimeString } from "@/types/entity";
import type { DeliveryAttemptStatus } from "@/modules/transport";

export interface ProviderReconciliationResult {
  receiptId: EntityId;
  deliveryAttemptId: EntityId | null;
  deliveryPlanId: EntityId | null;
  status:
    | "processed"
    | "duplicate_noop"
    | "ignored_missing_attempt"
    | "ignored_out_of_order"
    | "failed";
  previousAttemptStatus: DeliveryAttemptStatus | null;
  nextAttemptStatus: DeliveryAttemptStatus | null;
  retrySuppressed: boolean;
  processedAt: IsoDateTimeString;
  reason: string | null;
}
