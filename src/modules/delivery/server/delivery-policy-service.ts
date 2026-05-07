import "server-only";

import {
  DELIVERY_RECIPIENT_TYPES,
  DELIVERY_TYPES,
  type DeliveryPolicy,
  type DeliveryType,
} from "@/modules/delivery";

export interface DeliveryPolicyService {
  getPolicy(deliveryType: DeliveryType): DeliveryPolicy | null;
}

const DELIVERY_POLICIES: readonly DeliveryPolicy[] = [
  {
    deliveryType: DELIVERY_TYPES.EscalationFirstResponseBreachNotification,
    escalationType: "work_order.first_response_breach",
    recipientTypes: [
      DELIVERY_RECIPIENT_TYPES.AssignedCoordinator,
      DELIVERY_RECIPIENT_TYPES.AssignedManager,
      DELIVERY_RECIPIENT_TYPES.InternalOperationsGroup,
    ],
    channelByRecipientType: {
      assigned_coordinator: "internal",
      assigned_manager: "internal",
      internal_operations_group: "internal",
    },
    templateId: "delivery.escalation.first_response_breach",
    templateVersion: "v1",
    priority: "high",
    retry: {
      maxAttempts: 3,
      baseDelayMs: 15 * 60_000,
      maxDelayMs: 15 * 60_000,
      jitterRatio: 0.2,
    },
  },
] as const;

export function createDeliveryPolicyService(): DeliveryPolicyService {
  const policies = new Map<DeliveryType, DeliveryPolicy>(
    DELIVERY_POLICIES.map((policy) => [policy.deliveryType, policy]),
  );

  return {
    getPolicy(deliveryType) {
      return policies.get(deliveryType) ?? null;
    },
  };
}
