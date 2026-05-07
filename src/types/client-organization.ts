import type {
  AuditableEntity,
  CreateEntityInput,
  EntityId,
  UpdateEntityInput,
} from "@/types/entity";
import type { ContactLinkInput } from "@/types/contact";

export type ClientOrganizationStatus = "active" | "inactive";

export interface ClientOrganization extends AuditableEntity {
  name: string;
  displayName?: string;
  status: ClientOrganizationStatus;
  primaryContactId?: EntityId;
  billingContactId?: EntityId;
  notes?: string;
}

export interface CreateClientOrganizationInput extends CreateEntityInput {
  name: string;
  displayName?: string;
  status?: ClientOrganizationStatus;
  primaryContactId?: EntityId;
  billingContactId?: EntityId;
  linkedContacts?: ContactLinkInput[];
  notes?: string;
}

export interface UpdateClientOrganizationInput extends UpdateEntityInput {
  name?: string;
  displayName?: string | null;
  status?: ClientOrganizationStatus;
  primaryContactId?: EntityId | null;
  billingContactId?: EntityId | null;
  linkedContacts?: ContactLinkInput[];
  notes?: string | null;
}
