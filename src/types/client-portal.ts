import type { EntityId } from "@/types/entity";

export interface ClientPortalLandingSummary {
  organizationId: EntityId;
  organizationName: string;
  locationCount: number;
  activeWorkOrderCount: number;
  quotesAwaitingResponseCount: number;
}
