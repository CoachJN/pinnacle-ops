import type {
  ContactLinkDetail,
  ContactLinkInput,
  ContactSummary,
} from "@/types/contact";

export interface ClientOrganizationSummary {
  id: string;
  name: string;
  displayName?: string;
  status: "active" | "inactive";
  primaryContactId?: string;
  billingContactId?: string;
  primaryContact?: ContactSummary | null;
  billingContact?: ContactSummary | null;
  linkedContacts?: ContactLinkDetail[];
  updatedAt: string;
}

export interface ClientOrganizationDetail extends ClientOrganizationSummary {
  notes?: string;
  createdAt: string;
  recordStatus: "active" | "archived";
}

export interface ClientOrganizationFormValues {
  name: string;
  displayName: string;
  primaryContactId: string;
  billingContactId: string;
  linkedContacts: ContactLinkInput[];
  notes: string;
  isActive: boolean;
}

export interface ClientOrganizationFormErrors {
  name?: string;
  primaryContactId?: string;
  billingContactId?: string;
}
