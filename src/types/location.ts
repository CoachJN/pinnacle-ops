import type {
  AuditableEntity,
  CreateEntityInput,
  EntityId,
  RecordStatus,
  UpdateEntityInput,
} from "@/types/entity";

export type LocationStatus = "active" | "inactive";

export interface LocationClientReference {
  clientOrganizationId: EntityId;
}

export interface Location extends AuditableEntity, LocationClientReference {
  name: string;
  code?: string;
  status: LocationStatus;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
  locationContactName?: string;
  locationContactEmail?: string;
  locationContactPhone?: string;
  accessNotes?: string;
  notes?: string;
}

export interface CreateLocationInput
  extends CreateEntityInput,
    LocationClientReference {
  name: string;
  code?: string;
  status?: LocationStatus;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  countryCode?: string;
  locationContactName?: string;
  locationContactEmail?: string;
  locationContactPhone?: string;
  accessNotes?: string;
  notes?: string;
}

export interface UpdateLocationInput extends UpdateEntityInput {
  clientOrganizationId?: EntityId;
  name?: string;
  code?: string | null;
  status?: LocationStatus;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  postalCode?: string | null;
  countryCode?: string | null;
  locationContactName?: string | null;
  locationContactEmail?: string | null;
  locationContactPhone?: string | null;
  accessNotes?: string | null;
  notes?: string | null;
}

export interface LocationQueryFilters {
  clientOrganizationId?: EntityId;
  status?: LocationStatus;
  recordStatus?: RecordStatus;
  search?: string;
  limit?: number;
}
