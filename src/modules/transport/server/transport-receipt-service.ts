import "server-only";

import type { DeliveryAttempt, DeliveryReceipt } from "@/modules/transport";

export interface TransportReceiptService {
  createReceipt(input: {
    attempt: DeliveryAttempt;
    receipt?: Partial<DeliveryReceipt>;
  }): DeliveryReceipt;
}

export function createTransportReceiptService(): TransportReceiptService {
  return {
    createReceipt(input) {
      return {
        deliveryPlanId: input.attempt.deliveryPlanId,
        deliveryAttemptId: input.attempt.id,
        providerMessageId: input.receipt?.providerMessageId ?? input.attempt.providerMessageId ?? null,
        providerCorrelationId:
          input.receipt?.providerCorrelationId ?? input.attempt.providerCorrelationId ?? null,
        providerReceiptId: input.receipt?.providerReceiptId ?? input.attempt.providerReceiptId ?? null,
      };
    },
  };
}
