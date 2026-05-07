import "server-only";

import type { DeliveryChannel } from "@/modules/delivery";
import type { TransportAdapter } from "@/modules/transport";

export interface TransportAdapterRegistry {
  getByChannel(channel: DeliveryChannel): TransportAdapter | null;
  list(): readonly { adapterType: TransportAdapter["adapterType"]; channels: readonly DeliveryChannel[] }[];
}

export function createTransportAdapterRegistry(
  adapters: readonly TransportAdapter[],
): TransportAdapterRegistry {
  return {
    getByChannel(channel) {
      return adapters.find((adapter) => adapter.supportsChannel(channel)) ?? null;
    },
    list() {
      return adapters.map((adapter) => ({
        adapterType: adapter.adapterType,
        channels: ["internal", "email", "slack", "teams"].filter((channel) =>
          adapter.supportsChannel(channel as DeliveryChannel),
        ) as DeliveryChannel[],
      }));
    },
  };
}
