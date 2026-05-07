export const DELIVERY_RECIPIENT_TYPES = {
  AssignedCoordinator: "assigned_coordinator",
  AssignedManager: "assigned_manager",
  InternalOperationsGroup: "internal_operations_group",
} as const;

export type DeliveryRecipientType =
  (typeof DELIVERY_RECIPIENT_TYPES)[keyof typeof DELIVERY_RECIPIENT_TYPES];

export interface DeliveryRecipientTarget {
  recipientType: DeliveryRecipientType;
  recipientId: string;
  recipientAddress: string;
  displayName: string;
}
