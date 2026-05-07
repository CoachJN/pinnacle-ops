import type {
  AuditableEntity,
  CreateEntityInput,
  EntityId,
  IsoDateTimeString,
  RecordStatus,
  UpdateEntityInput,
} from "@/types/entity";
import type { ContactLinkInput } from "@/types/contact";

export type LocationStatus = "active" | "inactive";

export interface LocationClientReference {
  clientOrganizationId: EntityId;
}

export interface LocationAddressFields {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
}

export interface LocationOperationalFields {
  displayName?: string;
  storeNumber?: string;
  latitude?: number;
  longitude?: number;
  timeZone?: string;
  serviceNotes?: string;
  accessNotes?: string;
}

export interface Location
  extends AuditableEntity,
    LocationClientReference,
    LocationAddressFields,
    LocationOperationalFields {
  name: string;
  code?: string;
  status: LocationStatus;
  primaryContactId?: EntityId;
  siteContactId?: EntityId;
  notes?: string;
}

export interface CreateLocationInput
  extends CreateEntityInput,
    LocationClientReference,
    LocationAddressFields,
    LocationOperationalFields {
  name: string;
  code?: string;
  status?: LocationStatus;
  primaryContactId?: EntityId;
  siteContactId?: EntityId;
  linkedContacts?: ContactLinkInput[];
  notes?: string;
}

export interface UpdateLocationInput extends UpdateEntityInput {
  clientOrganizationId?: EntityId;
  name?: string;
  displayName?: string | null;
  code?: string | null;
  storeNumber?: string | null;
  status?: LocationStatus;
  primaryContactId?: EntityId | null;
  siteContactId?: EntityId | null;
  linkedContacts?: ContactLinkInput[];
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timeZone?: string | null;
  accessNotes?: string | null;
  serviceNotes?: string | null;
  notes?: string | null;
}

export interface LocationQueryFilters {
  clientOrganizationId?: EntityId;
  status?: LocationStatus;
  recordStatus?: RecordStatus;
  search?: string;
  limit?: number;
}

export interface ClientPortalLocationSummary {
  id: EntityId;
  clientOrganizationId: EntityId;
  name: string;
  displayName?: string;
  code?: string;
  storeNumber?: string;
  status: LocationStatus;
  city?: string;
  region?: string;
  countryCode?: string;
  timeZone?: string;
  updatedAt: IsoDateTimeString;
}

export interface ClientPortalLocationDetail extends ClientPortalLocationSummary {
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  primaryContactId?: EntityId;
  siteContactId?: EntityId;
  accessNotes?: string;
  serviceNotes?: string;
  createdAt: IsoDateTimeString;
}

export interface ClientPortalLocationUpdateInput {
  name: string;
  displayName?: string | null;
  code?: string | null;
  storeNumber?: string | null;
  status: LocationStatus;
  primaryContactId?: EntityId | null;
  siteContactId?: EntityId | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  timeZone?: string | null;
  accessNotes?: string | null;
  serviceNotes?: string | null;
}
