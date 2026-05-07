import type { DeliveryChannel } from "./delivery-channel";

export const NOTIFICATION_TEMPLATE_IDS = {
  EscalationFirstResponseBreach: "delivery.escalation.first_response_breach",
} as const;

export type NotificationTemplateId =
  (typeof NOTIFICATION_TEMPLATE_IDS)[keyof typeof NOTIFICATION_TEMPLATE_IDS];

export interface NotificationTemplateContract {
  templateId: NotificationTemplateId;
  templateVersion: string;
  supportedChannels: readonly DeliveryChannel[];
}
