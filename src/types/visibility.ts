import type { EntityId } from "@/types/entity";

export type VisibilityAudience = "internal" | "client" | "contractor";

export interface InternalRecordVisibility {
  audience: "internal";
  organizationId: EntityId;
}

export interface ClientRecordVisibility {
  audience: "client";
  organizationId: EntityId;
  clientOrganizationId: EntityId;
  locationId?: EntityId;
}

export interface ContractorRecordVisibility {
  audience: "contractor";
  organizationId: EntityId;
  contractorOrganizationId: EntityId;
  workOrderId?: EntityId;
  assignmentId?: EntityId;
}

export type RecordVisibility =
  | InternalRecordVisibility
  | ClientRecordVisibility
  | ContractorRecordVisibility;

export interface VisibilityTaggedRecord {
  visibility: RecordVisibility[];
}
