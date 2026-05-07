export const DELIVERY_CHANNELS = {
  Email: "email",
  Slack: "slack",
  Teams: "teams",
  Internal: "internal",
} as const;

export type DeliveryChannel =
  (typeof DELIVERY_CHANNELS)[keyof typeof DELIVERY_CHANNELS];
