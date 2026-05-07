import "server-only";

import { TRANSPORT_ADAPTER_TYPES, type TransportAdapter } from "@/modules/transport";

export function createInternalTransportAdapter(): TransportAdapter {
  return {
    adapterType: TRANSPORT_ADAPTER_TYPES.Internal,
    supportsChannel(channel) {
      return channel === "internal";
    },
    async execute(input) {
      const { deliveryPlan, attempt } = input.payload;
      return {
        outcome: "succeeded",
        message: "Internal transport execution recorded.",
        receipt: {
          deliveryPlanId: deliveryPlan.id,
          deliveryAttemptId: attempt.id,
          providerMessageId: `internal-message:${deliveryPlan.id}:${attempt.retryCount}`,
          providerCorrelationId: `internal-correlation:${attempt.correlationId}`,
          providerReceiptId: `internal-receipt:${attempt.id}`,
        },
        metadata: {
          mode: "placeholder_internal_transport",
          recipientAddress: deliveryPlan.recipientAddress,
          templateId: deliveryPlan.templateId,
          templateVersion: deliveryPlan.templateVersion,
        },
      };
    },
  };
}
