import type { EntityId } from "@/types/entity";
import type { FinancialVisibilityDomain } from "@/types/financial-controls";

export type VisibilityAudience = "internal" | "client" | "contractor";
export type VisibilityFieldMode = "hidden" | "read_only" | "editable";

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

export type FinancialVisibilityMap = Partial<
  Record<FinancialVisibilityDomain, boolean>
>;

export type FinancialFieldVisibilityMap = Readonly<
  Record<string, VisibilityFieldMode>
>;

export interface WorkOrderVisibilityProjection {
  financialSections: FinancialVisibilityMap;
  financialFields?: FinancialFieldVisibilityMap;
}

export interface VisibilityTaggedRecord {
  visibility: RecordVisibility[];
}
