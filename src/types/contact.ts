import type {
  AuditableEntity,
  CreateEntityInput,
  EntityId,
  UpdateEntityInput,
} from "@/types/entity";

export type PreferredLanguage = "en" | "fr" | "other" | "unknown";

export type PreferredContactMethod =
  | "email"
  | "phone"
  | "sms"
  | "other"
  | "unknown";

export type ContactStatus = "active" | "inactive" | "archived";

export type ContactRelationshipType =
  | "primary"
  | "billing"
  | "operations"
  | "site"
  | "dispatch"
  | "accounting"
  | "manager"
  | "after_hours"
  | "other";

export const CONTACT_RELATIONSHIP_TYPE_VALUES = [
  "primary",
  "billing",
  "operations",
  "site",
  "dispatch",
  "accounting",
  "manager",
  "after_hours",
  "other",
] as const satisfies readonly ContactRelationshipType[];

export interface Contact extends AuditableEntity {
  firstName: string;
  lastName: string;
  displayName: string;
  email?: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  roleTitle?: string;
  preferredLanguage: PreferredLanguage;
  preferredContactMethod?: PreferredContactMethod;
  notes?: string;
  status: ContactStatus;
}

export interface ContactSummary
  extends Pick<
    Contact,
    | "id"
    | "displayName"
    | "email"
    | "primaryPhone"
    | "preferredLanguage"
    | "roleTitle"
    | "status"
  > {}

export interface CreateContactInput extends CreateEntityInput {
  firstName: string;
  lastName: string;
  displayName?: string;
  email?: string;
  primaryPhone?: string;
  secondaryPhone?: string;
  roleTitle?: string;
  preferredLanguage?: PreferredLanguage;
  preferredContactMethod?: PreferredContactMethod;
  notes?: string;
  status?: ContactStatus;
}

export interface UpdateContactInput extends UpdateEntityInput {
  firstName?: string;
  lastName?: string;
  displayName?: string | null;
  email?: string | null;
  primaryPhone?: string | null;
  secondaryPhone?: string | null;
  roleTitle?: string | null;
  preferredLanguage?: PreferredLanguage;
  preferredContactMethod?: PreferredContactMethod | null;
  notes?: string | null;
  status?: ContactStatus;
}

export interface ClientOrganizationContactLink extends AuditableEntity {
  clientOrganizationId: EntityId;
  contactId: EntityId;
  relationshipType: ContactRelationshipType;
  isPrimary?: boolean;
  notes?: string;
}

export interface LocationContactLink extends AuditableEntity {
  locationId: EntityId;
  contactId: EntityId;
  relationshipType: ContactRelationshipType;
  isPrimary?: boolean;
  notes?: string;
}

export interface ContractorContactLink extends AuditableEntity {
  contractorId: EntityId;
  contactId: EntityId;
  relationshipType: ContactRelationshipType;
  isPrimary?: boolean;
  notes?: string;
}

export interface ContactLinkDetail {
  id: EntityId;
  contactId: EntityId;
  relationshipType: ContactRelationshipType;
  isPrimary: boolean;
  notes?: string;
  contact: ContactSummary;
}

export interface ContactLinkInput {
  contactId: EntityId;
  relationshipType: ContactRelationshipType;
  notes?: string | null;
}
