import type { EntityId, IsoDateTimeString } from "@/types/entity";

export type OperationalRecordStatus = "active" | "inactive";

export interface ClientOrganization {
  id: EntityId;
  name: string;
  status: OperationalRecordStatus;
  primaryContactName: string;
  primaryContactEmail: string | null;
  primaryContactPhone: string;
  notes: string | null;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  createdBy: string;
  lastUpdatedBy: string;
}

export interface Location {
  id: EntityId;
  clientId: EntityId;
  name: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  provinceOrState: string;
  postalCode: string;
  country: string;
  locationContactName: string;
  locationContactEmail: string | null;
  locationContactPhone: string;
  accessNotes: string | null;
  status: OperationalRecordStatus;
  createdAt: IsoDateTimeString;
  updatedAt: IsoDateTimeString;
  createdBy: string;
  lastUpdatedBy: string;
}

export type CreateClientOrganizationInput = Pick<
  ClientOrganization,
  | "name"
  | "status"
  | "primaryContactName"
  | "primaryContactEmail"
  | "primaryContactPhone"
  | "notes"
>;

export type UpdateClientOrganizationInput =
  Partial<CreateClientOrganizationInput>;

export type CreateLocationInput = Pick<
  Location,
  | "clientId"
  | "name"
  | "addressLine1"
  | "addressLine2"
  | "city"
  | "provinceOrState"
  | "postalCode"
  | "country"
  | "locationContactName"
  | "locationContactEmail"
  | "locationContactPhone"
  | "accessNotes"
  | "status"
>;

export type UpdateLocationInput = Partial<CreateLocationInput>;

export interface ClientPortalLandingSummary {
  organizationId: EntityId;
  organizationName: string;
  locationCount: number;
  activeWorkOrderCount: number;
  quotesAwaitingResponseCount: number;
}
