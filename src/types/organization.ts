import type { AuditableEntity, EntityId } from "@/types/entity";

export type ClientOrganizationStatus = "active" | "inactive";

export interface ClientOrganization extends AuditableEntity {
  name: string;
  displayName?: string;
  status: ClientOrganizationStatus;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
}

export type LocationStatus = "active" | "inactive";

export interface Location extends AuditableEntity {
  clientOrganizationId: EntityId;
  name: string;
  code?: string;
  status: LocationStatus;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
}

export type ContractorOrganizationStatus =
  | "active"
  | "inactive"
  | "pending_approval";

export interface ContractorOrganization extends AuditableEntity {
  name: string;
  displayName?: string;
  status: ContractorOrganizationStatus;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
}
