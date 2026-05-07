import type { DeliveryChannel } from "./delivery-channel";
import type { DeliveryRecipientType } from "./delivery-target";
import type { NotificationTemplateContract, NotificationTemplateId } from "./notification-template";

export const DELIVERY_TYPES = {
  EscalationFirstResponseBreachNotification: "escalation.first_response_breach_notification",
} as const;

export type DeliveryType =
  (typeof DELIVERY_TYPES)[keyof typeof DELIVERY_TYPES];

export const DELIVERY_PRIORITIES = {
  Normal: "normal",
  High: "high",
  Critical: "critical",
} as const;

export type DeliveryPriority =
  (typeof DELIVERY_PRIORITIES)[keyof typeof DELIVERY_PRIORITIES];

export interface DeliveryRetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterRatio: number;
}

export interface DeliveryPolicy {
  deliveryType: DeliveryType;
  escalationType: "work_order.first_response_breach";
  channelByRecipientType: Readonly<Record<DeliveryRecipientType, DeliveryChannel>>;
  recipientTypes: readonly DeliveryRecipientType[];
  templateId: NotificationTemplateId;
  templateVersion: string;
  priority: DeliveryPriority;
  retry: DeliveryRetryPolicy;
}

export const DELIVERY_TEMPLATE_CONTRACTS: readonly NotificationTemplateContract[] = [
  {
    templateId: "delivery.escalation.first_response_breach",
    templateVersion: "v1",
    supportedChannels: ["internal"],
  },
] as const;
