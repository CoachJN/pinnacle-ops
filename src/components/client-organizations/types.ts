export interface ClientOrganizationSummary {
  id: string;
  name: string;
  displayName?: string;
  status: "active" | "inactive";
  primaryContactName?: string;
  primaryContactEmail?: string;
  primaryContactPhone?: string;
  updatedAt: string;
}

export interface ClientOrganizationDetail extends ClientOrganizationSummary {
  billingEmail?: string;
  notes?: string;
  createdAt: string;
  recordStatus: "active" | "archived";
}

export interface ClientOrganizationFormValues {
  name: string;
  displayName: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
  billingEmail: string;
  notes: string;
  isActive: boolean;
}

export interface ClientOrganizationFormErrors {
  name?: string;
  primaryContactEmail?: string;
  billingEmail?: string;
}
