export interface LocationSummary {
  id: string;
  clientOrganizationId: string;
  clientSnapshot?: {
    id: string;
    name: string;
  };
  name: string;
  code?: string;
  status: "active" | "inactive";
  city?: string;
  region?: string;
  countryCode?: string;
  updatedAt: string;
}

export interface LocationDetail extends LocationSummary {
  addressLine1?: string;
  addressLine2?: string;
  postalCode?: string;
  locationContactName?: string;
  locationContactEmail?: string;
  locationContactPhone?: string;
  accessNotes?: string;
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
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  accessInstructions: string;
  notes: string;
  isActive: boolean;
}

export interface LocationFormErrors {
  clientOrganizationId?: string;
  name?: string;
  contactEmail?: string;
}
