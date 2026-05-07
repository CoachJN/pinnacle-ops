import type {
  ContactLinkDetail,
  ContactLinkInput,
  ContactSummary,
} from "@/types/contact";

export interface LocationSummary {
  id: string;
  clientOrganizationId: string;
  name: string;
  displayName?: string;
  code?: string;
  storeNumber?: string;
  status: "active" | "inactive";
  city?: string;
  region?: string;
  countryCode?: string;
  timeZone?: string;
  updatedAt: string;
}

export interface LocationDetail extends LocationSummary {
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  primaryContactId?: string;
  siteContactId?: string;
  primaryContact?: ContactSummary | null;
  siteContact?: ContactSummary | null;
  linkedContacts?: ContactLinkDetail[];
  latitude?: number;
  longitude?: number;
  accessNotes?: string;
  serviceNotes?: string;
  notes?: string;
  createdAt: string;
  recordStatus: "active" | "archived";
}

export interface LocationFormValues {
  clientOrganizationId: string;
  name: string;
  locationCode: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  primaryContactId: string;
  siteContactId: string;
  linkedContacts: ContactLinkInput[];
  accessInstructions: string;
  serviceNotes: string;
  notes: string;
  isActive: boolean;
}

export interface LocationFormErrors {
  clientOrganizationId?: string;
  name?: string;
  primaryContactId?: string;
  siteContactId?: string;
}
