import type { EntityId } from "@/types/entity";

export interface ProviderReceiptProcessJobPayload extends Record<string, unknown> {
  payloadVersion: "v1";
  receiptId: EntityId;
  reason: "provider_receipt_recorded" | "operator_reconcile";
}
