import type {
  AuditableEntity,
  CreateEntityInput,
  UpdateEntityInput,
} from "@/types/entity";

export type ClientOrganizationStatus = "active" | "inactive";

export interface ClientOrganization extends AuditableEntity {
  name: string;
  displayName?: string;
  status: ClientOrganizationStatus;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  billingEmail?: string;
  notes?: string;
}

export interface CreateClientOrganizationInput extends CreateEntityInput {
  name: string;
  displayName?: string;
  status?: ClientOrganizationStatus;
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  billingEmail?: string;
  notes?: string;
}

export interface UpdateClientOrganizationInput extends UpdateEntityInput {
  name?: string;
  displayName?: string | null;
  status?: ClientOrganizationStatus;
  primaryContactName?: string | null;
  primaryContactEmail?: string | null;
  primaryContactPhone?: string | null;
  billingEmail?: string | null;
  notes?: string | null;
}
